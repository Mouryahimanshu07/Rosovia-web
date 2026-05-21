// Verification types for Rosovia Module 13: Verification
//
// NOTE: VerificationLevel is defined in creator-profile.ts and re-exported from
// packages/core/src/index.ts. It is NOT redefined here to avoid conflicts.
// Import VerificationLevel directly from '@rosovia/core'.

export type VerificationType = 'creator' | 'seller' | 'mentor' | 'business';

export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected';

export type VerificationDocumentType =
  | 'identity'
  | 'business'
  | 'portfolio'
  | 'address'
  | 'certificate'
  | 'other';

/** Public request levels allowed in Module 13. trusted_seller is admin-only. */
export type PublicRequestableLevel = 'basic_verified' | 'creator_verified' | 'seller_verified';

export interface VerificationRequest {
  id: string;
  user_id: string;
  creator_id: string | null;
  verification_type: VerificationType;
  requested_level: PublicRequestableLevel;
  document_type: VerificationDocumentType;
  document_media_id: string;
  status: VerificationRequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Verification request joined with denormalized display fields. */
export interface VerificationRequestWithDetails extends VerificationRequest {
  /** Creator display name */
  creator_display_name: string | null;
  /** Creator slug — for linking */
  creator_slug: string | null;
  /** Document metadata (never includes private URL) */
  document_storage_key: string | null;
  document_mime_type: string | null;
  document_size_bytes: number | null;
  document_uploaded_at: string | null;
  /** Admin reviewer display name */
  reviewed_by_name: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input from the creator client to submit a verification request.
 * user_id, creator_id, status, reviewed_by, reviewed_at, admin_note
 * are all derived server-side — never accepted from client.
 */
export interface VerificationRequestCreateInput {
  verificationType: VerificationType;
  requestedLevel: PublicRequestableLevel;
  documentType: VerificationDocumentType;
  documentMediaId: string;
}

/** Input for admin review decision. */
export interface VerificationReviewInput {
  verificationRequestId: string;
  decision: 'approve' | 'reject';
  adminNote?: string;
}

export interface VerificationListParams {
  status?: VerificationRequestStatus;
  verificationType?: VerificationType;
  page?: number;
}
