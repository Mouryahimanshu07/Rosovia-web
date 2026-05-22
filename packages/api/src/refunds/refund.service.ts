import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RefundRequest,
  RefundListParams,
  CreateRefundRequestInput,
  Profile,
} from '@rosovia/core';
import {
  getRefundRequestById,
  listRefundRequestsByBuyerId,
  listRefundRequestsByOrderId,
  listAllRefundRequestsForAdmin,
  updateRefundRequestStatus,
} from './refund.repository';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createAdminAction } from '../reports/report.repository';
import { getPaymentById } from '../payments/payment.service';
import { updateOrder } from '../orders/order.repository';
import { refundRazorpayPayment } from '@rosovia/integrations';

export { getRefundRequestById, listRefundRequestsByOrderId };

// ---------------------------------------------------------------------------
// Internal: resolve active admin profile
// ---------------------------------------------------------------------------

async function resolveAdmin(supabase: SupabaseClient): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');
  if (profile.role !== 'admin') throw new Error('Admin access required');

  return profile;
}

// ---------------------------------------------------------------------------
// Buyer: request a refund for a paid order
//
// All critical business rules are enforced atomically in the database by
// public.create_refund_request_atomic (migration 021):
//   - Caller must be the buyer.
//   - Order payment_status must be 'paid' or 'partially_refunded'.
//   - Order must not be cancelled or refunded.
//   - Payment must belong to the order and be in a refundable state.
//   - Amount must be > 0 and <= payment amount.
//   - No active refund request already exists for this order.
//
// Narrow cast on supabase.rpc is required because migration 021 RPCs are not
// yet reflected in database.types.ts. Remove once types are regenerated.
// ---------------------------------------------------------------------------

export async function createCurrentBuyerRefundRequest(
  supabase: SupabaseClient,
  input: CreateRefundRequestInput
): Promise<RefundRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    'create_refund_request_atomic',
    {
      p_order_id:    input.orderId,
      p_payment_id:  input.paymentId,
      p_amount:      input.amount,
      p_reason:      input.reason,
      p_description: input.description ?? null,
    }
  ) as { data: RefundRequest | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Refund request creation failed');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Buyer: list own refund requests
// ---------------------------------------------------------------------------

export async function listBuyerRefundRequests(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: RefundListParams = {}
): Promise<RefundRequest[]> {
  return listRefundRequestsByBuyerId(supabase, buyerProfileId, params);
}

// ---------------------------------------------------------------------------
// Admin: list all refund requests
// ---------------------------------------------------------------------------

export async function listAdminRefundRequests(
  supabase: SupabaseClient,
  params: RefundListParams = {}
): Promise<RefundRequest[]> {
  await resolveAdmin(supabase);
  return listAllRefundRequestsForAdmin(supabase, params);
}

// ---------------------------------------------------------------------------
// Admin: moderate refund request
// ---------------------------------------------------------------------------

export async function moderateRefundRequest(
  supabase: SupabaseClient,
  refundId: string,
  action: 'approve' | 'reject' | 'process' | 'fail' | 'cancel',
  note?: string
): Promise<RefundRequest> {
  const admin = await resolveAdmin(supabase);

  const refund = await getRefundRequestById(supabase, refundId);
  if (!refund) {
    throw new Error('Refund request not found');
  }

  // Prevent buyer from approving their own refund request
  if (refund.buyer_id === admin.id && action === 'approve') {
    throw new Error('You cannot approve your own refund request.');
  }

  const now = new Date().toISOString();

  if (action === 'process') {
    if (refund.status !== 'approved') {
      throw new Error('Only approved refund requests can be processed.');
    }

    const payment = await getPaymentById(supabase, refund.payment_id);
    if (!payment) {
      throw new Error('Associated payment not found');
    }
    if (!payment.provider_payment_id) {
      throw new Error('No provider payment ID exists on the payment to refund');
    }

    try {
      // Execute the upstream Razorpay REST API call
      const refundResult = await refundRazorpayPayment({
        paymentId: payment.provider_payment_id,
        amountInPaise: Math.round(refund.amount * 100),
        notes: {
          rosovia_order_id: refund.order_id,
          rosovia_refund_id: refund.id,
        },
      });

      // Update provider_refund_id and processed_at
      const processUpdateData = {
        status: 'processed',
        admin_note: note ?? refund.admin_note,
        reviewed_by: admin.id,
        reviewed_at: now,
        processed_at: now,
        provider_refund_id: refundResult.id,
        failure_reason: null,
      };

      const updatedRefund = await updateRefundRequestStatus(supabase, refundId, processUpdateData);

      // Update order's payment_status to 'refunded' and order_status to 'refunded'
      await updateOrder(supabase, refund.order_id, {
        payment_status: 'refunded',
        order_status: 'refunded',
      });

      // Cancel the pending creator payout row
      await supabase
        .from('creator_payouts')
        .update({
          status: 'cancelled',
          admin_note: `Payout cancelled due to refund request process (Refund Request: ${refundId})`
        })
        .eq('order_id', refund.order_id)
        .eq('status', 'pending');

      // Log admin action as refund_processed
      await createAdminAction(supabase, {
        admin_id: admin.id,
        action_type: 'refund_processed',
        target_type: 'refund_request',
        target_id: refundId,
        note: note ?? null,
      });

      return updatedRefund;

    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Refund request processing failed: ${errMsg}`);

      // Capture the exception, transition DB refund request status to 'failed' with failure_reason
      const failUpdateData = {
        status: 'failed',
        admin_note: note ?? refund.admin_note,
        reviewed_by: admin.id,
        reviewed_at: now,
        failure_reason: errMsg,
      };

      await updateRefundRequestStatus(supabase, refundId, failUpdateData);

      // Log admin action as refund_failed
      await createAdminAction(supabase, {
        admin_id: admin.id,
        action_type: 'refund_failed',
        target_type: 'refund_request',
        target_id: refundId,
        note: `Failure reason: ${errMsg}`,
      });

      throw new Error(`Upstream refund processing failed: ${errMsg}`);
    }
  }

  // Handle other actions (approve, reject, fail, cancel)
  const actionMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    fail: 'failed',
    cancel: 'cancelled',
  };

  const status = actionMap[action];
  if (!status) throw new Error(`Invalid refund moderation action: ${action}`);

  const updateData: {
    status: string;
    admin_note: string | null;
    reviewed_by: string;
    reviewed_at: string;
  } = {
    status,
    admin_note: note ?? null,
    reviewed_by: admin.id,
    reviewed_at: now,
  };

  const updated = await updateRefundRequestStatus(supabase, refundId, updateData);

  // Log to admin action log
  const actionTypeMap: Record<'approve' | 'reject' | 'fail' | 'cancel', 'refund_approved' | 'refund_rejected' | 'refund_failed' | 'refund_cancelled'> = {
    approve: 'refund_approved',
    reject: 'refund_rejected',
    fail: 'refund_failed',
    cancel: 'refund_cancelled',
  };

  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: actionTypeMap[action as 'approve' | 'reject' | 'fail' | 'cancel'],
    target_type: 'refund_request',
    target_id: refundId,
    note: note ?? null,
  });

  return updated;
}

