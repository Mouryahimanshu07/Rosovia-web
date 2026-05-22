import { z } from 'zod';

export const REFUND_REASONS = [
  'duplicate_payment',
  'wrong_item',
  'not_delivered',
  'poor_quality',
  'creator_cancelled',
  'buyer_cancelled',
  'fraud_suspected',
  'other',
] as const;

export const REFUND_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'processed',
  'failed',
  'cancelled',
] as const;

export const refundRequestCreateSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  paymentId: z.string().uuid('Payment ID must be a valid UUID'),
  amount: z.number().positive('Refund amount must be greater than zero'),
  reason: z.enum(REFUND_REASONS, {
    message: 'Please select a valid refund reason',
  }),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional(),
});

export const refundAdminUpdateSchema = z.object({
  refundRequestId: z.string().uuid('Refund request ID must be a valid UUID'),
  status: z.enum(['approved', 'rejected', 'processed', 'failed', 'cancelled'], {
    message: 'Please select a valid refund status',
  }),
  adminNote: z
    .string()
    .max(2000, 'Admin note must be 2000 characters or fewer')
    .optional(),
  providerRefundId: z.string().max(255).optional(),
  failureReason: z
    .string()
    .max(2000, 'Failure reason must be 2000 characters or fewer')
    .optional(),
});

export const refundListParamsSchema = z.object({
  status: z.enum(REFUND_STATUSES).optional(),
  page: z.number().int().positive().default(1),
});

export type RefundRequestCreateInput = z.infer<typeof refundRequestCreateSchema>;
export type RefundAdminUpdateInput = z.infer<typeof refundAdminUpdateSchema>;
export type RefundListParamsInput = z.infer<typeof refundListParamsSchema>;