import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants (mirrored from DB constraints for client-side validation)
// ---------------------------------------------------------------------------

export const REPORT_TARGET_TYPES = [
  'creator',
  'listing',
  'review',
  'inquiry',
  'user',
  'post',
  'message',
] as const;


export const REPORT_REASONS = [
  'spam',
  'scam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'misleading_listing',
  'payment_issue',
  'abusive_review',
  'other',
] as const;

export const REPORT_STATUSES = [
  'pending',
  'reviewed',
  'resolved',
  'rejected',
] as const;

export const REPORT_MODERATION_ACTIONS = [
  'mark_reviewed',
  'resolve',
  'reject',
  'hide_review',
  'suspend_listing',
  'suspend_user',
] as const;

// ---------------------------------------------------------------------------
// 1. reportCreateSchema
//    Client guard: reporter_id, status, admin fields never come from client.
// ---------------------------------------------------------------------------

export const reportCreateSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES, {
    message: 'Please select a valid target type',
  }),

  targetId: z.string().uuid('Target ID must be a valid UUID'),

  reason: z.enum(REPORT_REASONS, {
    message: 'Please select a valid reason',
  }),

  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional(),
});

// ---------------------------------------------------------------------------
// 2. reportModerationSchema
//    Admin-only. adminId comes from current admin profile server-side.
// ---------------------------------------------------------------------------

export const reportModerationSchema = z.object({
  reportId: z.string().uuid('Report ID must be a valid UUID'),

  action: z.enum(REPORT_MODERATION_ACTIONS, {
    message: 'Please select a valid moderation action',
  }),

  adminNote: z
    .string()
    .max(2000, 'Admin note must be 2000 characters or fewer')
    .optional(),
});

// ---------------------------------------------------------------------------
// 3. reportListParamsSchema
// ---------------------------------------------------------------------------

export const reportListParamsSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
  page: z.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type ReportCreateSchemaInput = z.infer<typeof reportCreateSchema>;
export type ReportModerationSchemaInput = z.infer<typeof reportModerationSchema>;
export type ReportListParamsSchemaInput = z.infer<typeof reportListParamsSchema>;
