import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment, PaymentStatus } from '@rosovia/core';

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getPaymentById(
  supabase: SupabaseClient,
  id: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
  return data as Payment;
}

export async function getPaymentByOrderId(
  supabase: SupabaseClient,
  orderId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch payment by order ID: ${error.message}`);
  return data as Payment | null;
}

export async function getPaymentByProviderOrderId(
  supabase: SupabaseClient,
  providerOrderId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider_order_id', providerOrderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch payment by provider order ID: ${error.message}`);
  return data as Payment | null;
}

export async function getPaymentByProviderPaymentId(
  supabase: SupabaseClient,
  providerPaymentId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider_payment_id', providerPaymentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch payment by provider payment ID: ${error.message}`);
  return data as Payment | null;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function createPayment(
  supabase: SupabaseClient,
  data: {
    order_id: string;
    provider: 'razorpay';
    provider_order_id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
  }
): Promise<Payment> {
  const { data: created, error } = await supabase
    .from('payments')
    .insert({
      order_id: data.order_id,
      provider: data.provider,
      provider_order_id: data.provider_order_id,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create payment: ${error.message}`);
  return created as Payment;
}

export async function updatePayment(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    status: PaymentStatus;
    provider_payment_id: string | null;
    webhook_received: boolean;
    webhook_event_id: string | null;
    raw_payload: Record<string, unknown> | null;
  }>
): Promise<Payment> {
  const { data: updated, error } = await supabase
    .from('payments')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
  return updated as Payment;
}

export async function markPaymentWebhookReceived(
  supabase: SupabaseClient,
  data: {
    paymentId: string;
    status: PaymentStatus;
    providerPaymentId: string;
    webhookEventId: string | null;
    rawPayload: Record<string, unknown>;
  }
): Promise<Payment> {
  return updatePayment(supabase, data.paymentId, {
    status: data.status,
    provider_payment_id: data.providerPaymentId,
    webhook_received: true,
    webhook_event_id: data.webhookEventId,
    raw_payload: data.rawPayload,
  });
}

export async function listPaymentsForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list payments for order: ${error.message}`);
  return (data ?? []) as Payment[];
}

export async function markRazorpayCapturedAtomic(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    providerOrderId: string;
    providerPaymentId: string;
    amount: number;
    currency: string;
    payload: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase.rpc('mark_razorpay_payment_captured', {
    p_event_id: input.eventId,
    p_provider_order_id: input.providerOrderId,
    p_provider_payment_id: input.providerPaymentId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_payload: input.payload,
  });

  if (error) {
    throw new Error(`Failed to mark payment captured: ${error.message}`);
  }

  return data;
}

export async function markRazorpayFailedAtomic(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    providerOrderId: string;
    providerPaymentId: string;
    amount: number;
    currency: string;
    payload: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase.rpc('mark_razorpay_payment_failed', {
    p_event_id: input.eventId,
    p_provider_order_id: input.providerOrderId,
    p_provider_payment_id: input.providerPaymentId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_payload: input.payload,
  });

  if (error) {
    throw new Error(`Failed to mark payment failed: ${error.message}`);
  }

  return data;
}