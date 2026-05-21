import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helper: rating field (1–5 integer)
// ---------------------------------------------------------------------------

const ratingField = z
  .number()
  .int('Rating must be a whole number')
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating must be at most 5');

const optionalRatingField = ratingField.optional();

// ---------------------------------------------------------------------------
// 1. reviewCreateSchema
//    Buyer-submitted data only. Server derives buyer_id, creator_id,
//    listing_id from the order. is_hidden is never accepted from client.
// ---------------------------------------------------------------------------

export const reviewCreateSchema = z.object({
  /** The order being reviewed. Must be completed + paid. */
  orderId: z.string().uuid('Order ID must be a valid UUID'),

  /** Overall rating 1–5 (required). */
  rating: ratingField,

  /** Optional sub-rating: quality of product/service. */
  qualityRating: optionalRatingField,

  /** Optional sub-rating: creator communication. */
  communicationRating: optionalRatingField,

  /** Optional sub-rating: delivery / turnaround time. */
  deliveryRating: optionalRatingField,

  /** Optional review text. Max 2000 characters. */
  comment: z
    .string()
    .max(2000, 'Comment must be 2000 characters or fewer')
    .optional(),

  /** Optional reference to an existing media asset (future use). */
  mediaId: z
    .string()
    .uuid('Media ID must be a valid UUID')
    .optional(),
});

// ---------------------------------------------------------------------------
// 2. reviewListParamsSchema
// ---------------------------------------------------------------------------

export const reviewListParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  rating: ratingField.optional(),
});

// ---------------------------------------------------------------------------
// 3. adminReviewVisibilitySchema
//    Used server-side only. No admin UI in Module 12.
// ---------------------------------------------------------------------------

export const adminReviewVisibilitySchema = z.object({
  reviewId: z.string().uuid('Review ID must be a valid UUID'),
  isHidden: z.boolean(),
  note: z
    .string()
    .max(1000, 'Note must be 1000 characters or fewer')
    .optional(),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type ReviewCreateSchemaInput = z.infer<typeof reviewCreateSchema>;
export type ReviewListParamsSchemaInput = z.infer<typeof reviewListParamsSchema>;
export type AdminReviewVisibilitySchemaInput = z.infer<typeof adminReviewVisibilitySchema>;
