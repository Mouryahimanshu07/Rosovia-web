// Refund types for Rosovia – refund_requests table

import type { PaymentStatus } from './order';

export type RefundStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'processed'
  | 'failed'
  | 'cancelled';

export type RefundReason =
  | 'duplicate_payment'
  | 'wrong_item'
  | 'not_delivered'
  | 'poor_quality'
  | 'creator_cancelled'
  | 'buyer_cancelled'
  | 'fraud_suspected'
  | 'other';

export interface RefundRequest {
  id: string;
  order_id: string;
  payment_id: string;
  buyer_id: string;
  amount: number;
  currency: string;
  reason: RefundReason;
  description: string | null;
  status: RefundStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  provider_refund_id: string | null;
  processed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input from the buyer to request a refund for a paid order.
 * All validation (amount bounds, order status, payment status) is performed
 * atomically by the create_refund_request_atomic DB RPC.
 */
export interface CreateRefundRequestInput {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: RefundReason;
  description?: string;
}

export interface RefundListParams {
  status?: RefundStatus;
  page?: number;
}

// Kept consistent with PaymentStatus import — avoids re-declaring the union
export type { PaymentStatus };
