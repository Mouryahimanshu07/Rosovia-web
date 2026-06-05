// Report types for Rosovia Module 14: Reports and Moderation

export type ReportTargetType = 'creator' | 'listing' | 'review' | 'inquiry' | 'user' | 'post';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected';

export type ReportReason =
  | 'spam'
  | 'scam'
  | 'harassment'
  | 'inappropriate_content'
  | 'fake_profile'
  | 'misleading_listing'
  | 'payment_issue'
  | 'abusive_review'
  | 'other';

export type ReportModerationAction =
  | 'mark_reviewed'
  | 'resolve'
  | 'reject'
  | 'hide_review'
  | 'suspend_listing'
  | 'suspend_user';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Report with denormalized display fields for dashboards */
export interface ReportWithDetails extends Report {
  /** Reporter's display name */
  reporter_display_name: string | null;
  /** Admin reviewer's display name */
  reviewed_by_name: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Data from the client to create a report.
 * reporter_id, status, reviewed_by, reviewed_at, admin_note
 * are all derived server-side — never accepted from the client.
 */
export interface ReportCreateInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

/** Input for admin moderation action on a report. */
export interface ReportModerationInput {
  reportId: string;
  action: ReportModerationAction;
  adminNote?: string;
}

export interface ReportListParams {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  page?: number;
}
