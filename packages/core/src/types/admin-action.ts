// Admin action types for Rosovia Module 14: Reports and Moderation

export type AdminActionType =
  | 'report_reviewed'
  | 'report_resolved'
  | 'report_rejected'
  | 'review_hidden'
  | 'review_unhidden'
  | 'listing_suspended'
  | 'listing_unsuspended'
  | 'listing_approved'
  | 'listing_rejected'
  | 'user_suspended'
  | 'user_unsuspended'
  | 'creator_suspended'
  | 'creator_unsuspended'
  | 'verification_reviewed'
  | 'category_created'
  | 'category_updated'
  | 'refund_requested'
  | 'refund_approved'
  | 'refund_rejected'
  | 'refund_processed'
  | 'refund_failed'
  | 'refund_cancelled'
  | 'dispute_opened'
  | 'dispute_under_review'
  | 'dispute_resolved'
  | 'dispute_rejected'
  | 'payout_created'
  | 'payout_processing'
  | 'payout_paid'
  | 'payout_failed'
  | 'payout_on_hold'
  | 'manual_note';

export type AdminActionTargetType =
  | 'report'
  | 'category'
  | 'creator'
  | 'listing'
  | 'review'
  | 'user'
  | 'verification_request'
  | 'order'
  | 'payment'
  | 'refund_request'
  | 'dispute'
  | 'creator_payout';

export interface AdminAction {
  id: string;
  admin_id: string | null;
  action_type: AdminActionType;
  target_type: AdminActionTargetType;
  target_id: string;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
