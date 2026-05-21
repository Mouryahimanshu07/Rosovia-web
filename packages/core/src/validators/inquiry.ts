import { z } from 'zod';

export const INQUIRY_TYPES = [
  'general',
  'product',
  'service',
  'mentorship',
  'custom_order',
] as const;

export const INQUIRY_STATUSES = [
  'open',
  'replied',
  'closed',
  'spam',
] as const;

/**
 * Schema for creating a new inquiry.
 * buyerId, status, creatorResponse are excluded — resolved server-side.
 */
export const inquiryCreateSchema = z.object({
  creatorId: z.string().uuid('Creator ID must be a valid UUID'),
  listingId: z.string().uuid('Listing ID must be a valid UUID').optional(),
  inquiryType: z.enum(INQUIRY_TYPES, { message: 'Please select a valid inquiry type' }),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be 2000 characters or fewer'),
});

/**
 * Schema for a creator replying to an inquiry.
 * creatorId is resolved from the authenticated session, not from client.
 */
export const inquiryReplySchema = z.object({
  inquiryId: z.string().uuid('Inquiry ID must be a valid UUID'),
  creatorResponse: z
    .string()
    .min(2, 'Response must be at least 2 characters')
    .max(2000, 'Response must be 2000 characters or fewer'),
});

/**
 * Schema for updating inquiry status.
 * Used by both buyer (can only close) and creator (replied/closed/spam).
 * Caller enforces which statuses are allowed based on role.
 */
export const inquiryStatusUpdateSchema = z.object({
  inquiryId: z.string().uuid('Inquiry ID must be a valid UUID'),
  status: z.enum(INQUIRY_STATUSES, { message: 'Please select a valid status' }),
});

/**
 * Schema for listing/filtering inquiries.
 */
export const inquiryListParamsSchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  page: z.number().int().positive().default(1),
});

export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;
export type InquiryReplyInput = z.infer<typeof inquiryReplySchema>;
export type InquiryStatusUpdateInput = z.infer<typeof inquiryStatusUpdateSchema>;
export type InquiryListParamsInput = z.infer<typeof inquiryListParamsSchema>;
