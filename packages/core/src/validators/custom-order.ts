import { z } from 'zod';

/** All statuses the DB can hold (for future module compatibility). */
export const CUSTOM_ORDER_ALL_STATUSES = [
  'requested',
  'creator_reviewing',
  'quoted',
  'accepted',
  'rejected',
  'payment_pending',
  'paid',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const;

/** Statuses actively used in Module 9 UI flows. */
export const CUSTOM_ORDER_ACTIVE_STATUSES = [
  'requested',
  'creator_reviewing',
  'quoted',
  'accepted',
  'rejected',
  'cancelled',
] as const;

/** Status transitions a creator can trigger in Module 9. */
export const CREATOR_CUSTOM_ORDER_ACTIONS = [
  'mark_reviewing',
  'reject',
  'cancel',
] as const;

/** Status transitions a buyer can trigger in Module 9. */
export const BUYER_CUSTOM_ORDER_ACTIONS = [
  'accept_quote',
  'cancel',
] as const;

// ---------------------------------------------------------------------------
// 1. Buyer create schema
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new custom order.
 * buyerId, status, and creator quote fields are excluded — resolved server-side.
 */
export const customOrderCreateSchema = z
  .object({
    creatorId: z.string().uuid('Creator ID must be a valid UUID'),
    listingId: z.string().uuid('Listing ID must be a valid UUID').optional(),
    categoryId: z.string().uuid('Category ID must be a valid UUID'),
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(160, 'Title must be 160 characters or fewer'),
    description: z
      .string()
      .min(20, 'Description must be at least 20 characters')
      .max(4000, 'Description must be 4000 characters or fewer'),
    referenceMediaId: z.string().uuid('Reference media ID must be a valid UUID').optional(),
    budgetMin: z.number().nonnegative('Budget minimum must be 0 or more').optional(),
    budgetMax: z.number().nonnegative('Budget maximum must be 0 or more').optional(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be a date in YYYY-MM-DD format').optional(),
    deliveryCity: z.string().max(80, 'City must be 80 characters or fewer').optional(),
    deliveryState: z.string().max(80, 'State must be 80 characters or fewer').optional(),
  })
  .refine(
    (data) => {
      if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
        return data.budgetMax >= data.budgetMin;
      }
      return true;
    },
    {
      message: 'Budget maximum must be greater than or equal to budget minimum',
      path: ['budgetMax'],
    }
  );

// ---------------------------------------------------------------------------
// 2. Creator quote schema
// ---------------------------------------------------------------------------

export const creatorQuoteCustomOrderSchema = z.object({
  customOrderId: z.string().uuid('Custom order ID must be a valid UUID'),
  creatorQuoteAmount: z
    .number({ message: 'Quote amount is required and must be a number' })
    .nonnegative('Quote amount must be 0 or more'),
  creatorQuoteNote: z
    .string()
    .max(2000, 'Quote note must be 2000 characters or fewer')
    .optional(),
});

// ---------------------------------------------------------------------------
// 3. Status update schema (covers all buyer and creator actions)
// ---------------------------------------------------------------------------

export const customOrderStatusUpdateSchema = z.object({
  customOrderId: z.string().uuid('Custom order ID must be a valid UUID'),
  action: z.enum(['mark_reviewing', 'accept_quote', 'reject', 'cancel'], {
    message: 'Invalid action',
  }),
});

// ---------------------------------------------------------------------------
// 4. List / filter params
// ---------------------------------------------------------------------------

export const customOrderListParamsSchema = z.object({
  status: z.enum(CUSTOM_ORDER_ACTIVE_STATUSES).optional(),
  page: z.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Inferred input types (canonical — do not re-declare in types/custom-order.ts)
// ---------------------------------------------------------------------------

export type CustomOrderCreateInput = z.infer<typeof customOrderCreateSchema>;
export type CreatorQuoteCustomOrderInput = z.infer<typeof creatorQuoteCustomOrderSchema>;
export type CustomOrderStatusUpdateInput = z.infer<typeof customOrderStatusUpdateSchema>;
export type CustomOrderListParamsInput = z.infer<typeof customOrderListParamsSchema>;
