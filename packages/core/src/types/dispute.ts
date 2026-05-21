// Dispute types for Rosovia – disputes table

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'resolved'
  | 'rejected';

export type DisputeReason =
  | 'payment_issue'
  | 'not_delivered'
  | 'late_delivery'
  | 'quality_issue'
  | 'wrong_item'
  | 'miscommunication'
  | 'fraud_suspected'
  | 'abusive_behavior'
  | 'other';

export interface Dispute {
  id: string;
  order_id: string;
  opened_by: string;
  reason: DisputeReason;
  description: string | null;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input from a buyer or creator to open a dispute on an order.
 * All validation (role check, duplicate check, order state) is performed
 * atomically by the create_dispute_atomic DB RPC.
 */
export interface CreateDisputeInput {
  orderId: string;
  reason: DisputeReason;
  description?: string;
}

export interface DisputeListParams {
  status?: DisputeStatus;
  page?: number;
}
