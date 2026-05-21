import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants (mirrored from DB constraints for client-side validation)
// ---------------------------------------------------------------------------

export const VERIFICATION_TYPES = ['creator', 'seller', 'mentor', 'business'] as const;

/** Public requestable levels — trusted_seller is excluded from client requests. */
export const REQUESTABLE_LEVELS = [
  'basic_verified',
  'creator_verified',
  'seller_verified',
] as const;

export const VERIFICATION_DOCUMENT_TYPES = [
  'identity',
  'business',
  'portfolio',
  'address',
  'certificate',
  'other',
] as const;

// ---------------------------------------------------------------------------
// 1. verificationRequestCreateSchema
//    Buyer-side guard: user_id, creator_id, status, reviewed_* never come from client.
// ---------------------------------------------------------------------------

export const verificationRequestCreateSchema = z.object({
  /** Type of verification being requested. */
  verificationType: z.enum(VERIFICATION_TYPES, {
    message: 'Please select a valid verification type',
  }),

  /**
   * The verification level being requested.
   * trusted_seller is intentionally excluded — admin-only.
   */
  requestedLevel: z.enum(REQUESTABLE_LEVELS, {
    message: 'Please select a valid verification level',
  }),

  /** Category of document being submitted. */
  documentType: z.enum(VERIFICATION_DOCUMENT_TYPES, {
    message: 'Please select a valid document type',
  }),

  /** UUID of the private media asset to use as verification document. */
  documentMediaId: z.string().uuid('Document media ID must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// 2. verificationReviewSchema
//    Admin-only. reviewedBy and reviewedAt are set server-side.
// ---------------------------------------------------------------------------

export const verificationReviewSchema = z.object({
  verificationRequestId: z.string().uuid('Verification request ID must be a valid UUID'),
  decision: z.enum(['approve', 'reject'] as const, {
    message: 'Decision must be approve or reject',
  }),
  adminNote: z
    .string()
    .max(2000, 'Admin note must be 2000 characters or fewer')
    .optional(),
});

// ---------------------------------------------------------------------------
// 3. verificationListParamsSchema
// ---------------------------------------------------------------------------

export const verificationListParamsSchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected'])
    .optional(),
  verificationType: z
    .enum(VERIFICATION_TYPES)
    .optional(),
  page: z.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type VerificationRequestCreateSchemaInput = z.infer<typeof verificationRequestCreateSchema>;
export type VerificationReviewSchemaInput = z.infer<typeof verificationReviewSchema>;
export type VerificationListParamsSchemaInput = z.infer<typeof verificationListParamsSchema>;
