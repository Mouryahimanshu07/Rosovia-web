import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Payment,
  RazorpayCheckoutData,
  RazorpayWebhookEvent,
  CreatePaymentForOrderInput,
} from '@rosovia/core';
import { razorpayWebhookEventSchema, isPaymentsEnabled } from '@rosovia/core';
import { createRazorpayOrder, getRazorpayKeyId } from '@rosovia/integrations';
import { verifyRazorpayWebhookSignature, getRazorpayWebhookSecret } from '@rosovia/integrations';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { updateOrder } from '../orders/order.repository';
import {
  getPaymentById,
  getPaymentByOrderId,
  getPaymentByProviderOrderId,
  createPayment,
  updatePayment,
  listPaymentsForOrder,
  markRazorpayCapturedAtomic,
  markRazorpayFailedAtomic,
} from './payment.repository';

export {
  getPaymentById,
  getPaymentByOrderId,
  listPaymentsForOrder,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// 1. Buyer: create/initiate payment for an existing order
// ---------------------------------------------------------------------------

export async function createPaymentForCurrentBuyerOrder(
  supabase: SupabaseClient,
  input: CreatePaymentForOrderInput
): Promise<RazorpayCheckoutData> {
  if (!isPaymentsEnabled()) {
    throw new Error('Online payment is currently disabled. You can still contact the creator or request a custom order.');
  }

  const profile = await resolveActiveProfile(supabase);

  // Fetch and validate the order
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_id, amount, currency, order_status, payment_status, deleted_at')
    .eq('id', input.orderId)
    .is('deleted_at', null)
    .single();

  if (orderError || !orderRow) {
    throw new Error('Order not found');
  }

  const order = orderRow as {
    id: string;
    buyer_id: string;
    amount: number;
    currency: string;
    order_status: string;
    payment_status: string;
  };

  // Must be the buyer's own order
  if (order.buyer_id !== profile.id) {
    throw new Error('This order does not belong to you');
  }

  // Order must be in a payable state
  if (!['payment_pending', 'accepted'].includes(order.order_status)) {
    throw new Error(
      `Cannot initiate payment for an order with status "${order.order_status}"`
    );
  }

  // Payment status must be created, pending, or failed (allow retry on failed)
  if (!['created', 'pending', 'failed'].includes(order.payment_status)) {
    throw new Error(
      `Cannot initiate payment: current payment status is "${order.payment_status}"`
    );
  }

  // Amount must be > 0
  if (!order.amount || order.amount <= 0) {
    throw new Error('Order amount must be greater than zero');
  }

  // Only INR supported in Module 11
  if (order.currency !== 'INR') {
    throw new Error(`Currency "${order.currency}" is not supported. Only INR is accepted.`);
  }

  // Check if a pending payment already exists (avoid duplicate Razorpay orders)
  const existingPayment = await getPaymentByOrderId(supabase, order.id);
  if (existingPayment && existingPayment.status === 'pending' && existingPayment.provider_order_id) {
    // Return existing checkout data to allow retry without creating a new Razorpay order
    return {
      razorpayKeyId: getRazorpayKeyId(),
      providerOrderId: existingPayment.provider_order_id,
      amountInPaise: Math.round(order.amount * 100),
      currency: order.currency,
      orderId: order.id,
      appPaymentId: existingPayment.id,
    };
  }

  // Create Razorpay order
  const amountInPaise = Math.round(order.amount * 100);
  const receipt = `rosovia_${order.id.slice(0, 16)}`;

  const razorpayOrder = await createRazorpayOrder({
    amountInPaise,
    currency: order.currency,
    receipt,
    notes: {
      rosovia_order_id: order.id,
      buyer_profile_id: profile.id,
    },
  });

  // Create fresh payment record
  const payment = await createPayment(supabase, {
    order_id: order.id,
    provider: 'razorpay',
    provider_order_id: razorpayOrder.id,
    amount: order.amount,
    currency: order.currency,
    status: 'pending',
  });

  // Update order payment_status to pending
  await updateOrder(supabase, order.id, { payment_status: 'pending' });

  return {
    razorpayKeyId: getRazorpayKeyId(),
    providerOrderId: razorpayOrder.id,
    amountInPaise,
    currency: order.currency,
    orderId: order.id,
    appPaymentId: payment.id,
  };
}

// ---------------------------------------------------------------------------
// 2. Handle Razorpay webhook (trusted server context — uses admin client)
// ---------------------------------------------------------------------------

export async function handleRazorpayWebhook(
  /** Admin/service-role Supabase client — bypasses RLS */
  adminSupabase: SupabaseClient,
  rawBody: string,
  signature: string
): Promise<{ processed: boolean; duplicate: boolean; message: string }> {
  // Step 1: Verify signature BEFORE parsing body
  const webhookSecret = getRazorpayWebhookSecret();
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);

  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }

  // Step 2: Parse body only after signature is verified
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid webhook payload — not valid JSON');
  }

  // Step 3: Validate schema
  const parsed = razorpayWebhookEventSchema.safeParse(parsedBody);
  if (!parsed.success) {
    // Log but don't crash on unexpected shape — return success to prevent retries
    console.warn('Razorpay webhook: unexpected payload shape', parsed.error.issues[0]?.message);
    return { processed: false, duplicate: false, message: 'Unrecognized event shape' };
  }

  const event: RazorpayWebhookEvent = parsed.data;
  const eventType = event.event;

  // Only handle payment.captured and payment.failed in Module 11
  if (!['payment.captured', 'payment.failed'].includes(eventType)) {
    return { processed: false, duplicate: false, message: `Event "${eventType}" not handled` };
  }

  const paymentEntity = event.payload.payment?.entity;
  if (!paymentEntity) {
    return { processed: false, duplicate: false, message: 'No payment entity in payload' };
  }

  const providerOrderId = paymentEntity.order_id;
  const providerPaymentId = paymentEntity.id;

  // Derive idempotency key: use provider_payment_id as primary key
  // Fall back to provider_order_id + event type
  const webhookEventId = providerPaymentId
    ? `${eventType}:${providerPaymentId}`
    : `${eventType}:${providerOrderId}`;

  // Step 4: Idempotency — find the payment row
  const existingPayment = await getPaymentByProviderOrderId(adminSupabase, providerOrderId);

  if (!existingPayment) {
    console.warn(`Webhook: no payment found for Razorpay order ID ${providerOrderId}`);
    // Return 200 to prevent retries for unknown orders
    return { processed: false, duplicate: false, message: 'Payment record not found' };
  }

  // Step 5: Duplicate check — if webhook_event_id already processed, skip
  if (existingPayment.webhook_event_id === webhookEventId) {
    return { processed: true, duplicate: true, message: 'Duplicate webhook — already processed' };
  }

  // Also check by provider_payment_id if already set (stronger dedup)
  if (existingPayment.provider_payment_id && existingPayment.provider_payment_id === providerPaymentId) {
    if (existingPayment.status === 'paid' && eventType === 'payment.captured') {
      return { processed: true, duplicate: true, message: 'Already marked paid' };
    }
    if (existingPayment.status === 'failed' && eventType === 'payment.failed') {
      return { processed: true, duplicate: true, message: 'Already marked failed' };
    }
  }

  const rawPayload = parsedBody as Record<string, unknown>;

  // ---------------------------------------------------------------------------
  // payment.captured — mark as paid
  // ---------------------------------------------------------------------------
  if (eventType === 'payment.captured') {
    // Guard: entity status must be 'captured'
    if (paymentEntity.status !== 'captured') {
      return { processed: false, duplicate: false, message: 'Payment event is not captured' };
    }

    // Guard: currency must match
    if (paymentEntity.currency !== existingPayment.currency) {
      return { processed: false, duplicate: false, message: 'Currency mismatch' };
    }

    // Guard: provider order must match
    if (paymentEntity.order_id !== existingPayment.provider_order_id) {
      return { processed: false, duplicate: false, message: 'Provider order mismatch' };
    }

    // Guard: verify amount matches (prevent amount tampering)
    const expectedPaise = Math.round(existingPayment.amount * 100);
    if (paymentEntity.amount !== expectedPaise) {
      console.error(
        `Webhook amount mismatch: expected ${expectedPaise} paise, got ${paymentEntity.amount}`
      );
      return { processed: false, duplicate: false, message: 'Amount mismatch — not marking paid' };
    }

    // Atomically mark the payment as paid and transition the order status
    await markRazorpayCapturedAtomic(adminSupabase, {
      eventId: webhookEventId,
      providerOrderId,
      providerPaymentId,
      amount: paymentEntity.amount,
      currency: paymentEntity.currency,
      payload: rawPayload,
    });

    // Auto-create the creator payout row for this order.
    // Non-fatal: a payout creation failure must not cause a 500 that triggers
    // Razorpay retries and double-processes the payment.
    try {
      await (adminSupabase as any).rpc('create_creator_payout_for_order', {
        p_order_id: existingPayment.order_id,
      });
    } catch (payoutErr) {
      console.error(
        'Webhook: failed to create creator payout (non-fatal):',
        payoutErr instanceof Error ? payoutErr.message : payoutErr
      );
    }

    return { processed: true, duplicate: false, message: 'Payment marked as paid' };
  }

  // ---------------------------------------------------------------------------
  // payment.failed — mark as failed
  // ---------------------------------------------------------------------------
  if (eventType === 'payment.failed') {
    // Guard: entity status must be 'failed' — check BEFORE writing to the DB
    if (paymentEntity.status !== 'failed') {
      return { processed: false, duplicate: false, message: 'Payment event is not failed' };
    }

    // Atomically mark the payment as failed
    await markRazorpayFailedAtomic(adminSupabase, {
      eventId: webhookEventId,
      providerOrderId,
      providerPaymentId,
      amount: paymentEntity.amount,
      currency: paymentEntity.currency,
      payload: rawPayload,
    });

    // Update order payment_status = failed, keep order_status = payment_pending
    // (buyer can retry payment)
    await updateOrder(adminSupabase, existingPayment.order_id, {
      payment_status: 'failed',
    });

    return { processed: true, duplicate: false, message: 'Payment marked as failed' };
  }

  return { processed: false, duplicate: false, message: 'Unhandled event type' };
}

// ---------------------------------------------------------------------------
// 3. Get current buyer order + payment state
// ---------------------------------------------------------------------------

export async function getCurrentBuyerOrderPaymentState(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ payment: Payment | null } | null> {
  const profile = await resolveActiveProfile(supabase);

  // Verify the order belongs to this buyer
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id, buyer_id')
    .eq('id', orderId)
    .eq('buyer_id', profile.id)
    .is('deleted_at', null)
    .single();

  if (!orderRow) return null;

  const payment = await getPaymentByOrderId(supabase, orderId);
  return { payment };
}
