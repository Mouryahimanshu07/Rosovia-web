import { z } from 'zod';

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

export const ORDER_ALL_STATUSES = [
  'draft',
  'requested',
  'accepted',
  'payment_pending',
  'paid',
  'in_progress',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'refunded',
] as const;

/** Statuses the Module 10 UI actively shows and works with. */
export const ORDER_ACTIVE_STATUSES = [
  'payment_pending',
  'accepted',
  'in_progress',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const;

export const PAYMENT_ALL_STATUSES = [
  'created',
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

// ---------------------------------------------------------------------------
// 1. Create order from approved listing
// ---------------------------------------------------------------------------

/**
 * Only the listing ID comes from the client.
 * buyerId, creatorId, amount are resolved server-side.
 */
export const createListingOrderSchema = z.object({
  listingId: z.string().uuid('Listing ID must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// 2. Create order from accepted custom order
// ---------------------------------------------------------------------------

/**
 * Only the custom order ID comes from the client.
 * buyerId, creatorId, amount are resolved from the accepted custom order server-side.
 */
export const createCustomOrderOrderSchema = z.object({
  customOrderId: z.string().uuid('Custom order ID must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// 3. Order status update
// ---------------------------------------------------------------------------

export const orderStatusUpdateSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  action: z.enum(
    [
      'cancel',
      'mark_accepted',
      'mark_in_progress',
      'mark_shipped',
      'mark_delivered',
      'mark_completed',
      'mark_disputed',
    ],
    { message: 'Invalid action' }
  ),
  note: z.string().max(1000, 'Note must be 1000 characters or fewer').optional(),
});

// ---------------------------------------------------------------------------
// 4. List / filter params
// ---------------------------------------------------------------------------

export const orderListParamsSchema = z.object({
  status: z.enum(ORDER_ACTIVE_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_ALL_STATUSES).optional(),
  page: z.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type CreateListingOrderSchemaInput = z.infer<typeof createListingOrderSchema>;
export type CreateCustomOrderOrderSchemaInput = z.infer<typeof createCustomOrderOrderSchema>;
export type OrderStatusUpdateSchemaInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderListParamsSchemaInput = z.infer<typeof orderListParamsSchema>;
