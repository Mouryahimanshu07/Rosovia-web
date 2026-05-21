import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RefundRequest,
  RefundListParams,
  CreateRefundRequestInput,
} from '@rosovia/core';
import {
  getRefundRequestById,
  listRefundRequestsByBuyerId,
  listRefundRequestsByOrderId,
} from './refund.repository';

export { getRefundRequestById, listRefundRequestsByOrderId };

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
