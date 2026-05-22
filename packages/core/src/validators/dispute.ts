import { z } from 'zod';

export const DISPUTE_REASONS = [
  'payment_issue',
  'not_delivered',
  'late_delivery',
  'quality_issue',
  'wrong_item',
  'miscommunication',
  'fraud_suspected',
  'abusive_behavior',
  'other',
] as const;

export const DISPUTE_STATUSES = [
  'open',
  'under_review',
  'resolved',
  'rejected',
] as const;

export const disputeCreateSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  reason: z.enum(DISPUTE_REASONS, {
    message: 'Please select a valid dispute reason',
  }),
  description: z
    .string()
    .max(3000, 'Description must be 3000 characters or fewer')
    .optional(),
});

export const disputeAdminUpdateSchema = z.object({
  disputeId: z.string().uuid('Dispute ID must be a valid UUID'),
  status: z.enum(['under_review', 'resolved', 'rejected'], {
    message: 'Please select a valid dispute status',
  }),
  resolutionNote: z
    .string()
    .max(3000, 'Resolution note must be 3000 characters or fewer')
    .optional(),
});

export const disputeListParamsSchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
  page: z.number().int().positive().default(1),
});

export type DisputeCreateInput = z.infer<typeof disputeCreateSchema>;
export type DisputeAdminUpdateInput = z.infer<typeof disputeAdminUpdateSchema>;
export type DisputeListParamsInput = z.infer<typeof disputeListParamsSchema>;