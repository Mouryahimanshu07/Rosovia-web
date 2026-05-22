// Order types for Rosovia Module 10: Orders

export type OrderStatus =
  | 'draft'
  | 'requested'
  | 'accepted'
  | 'payment_pending'
  | 'paid'
  | 'in_progress'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

/**
 * Statuses that the Module 10 application layer actively works with.
 * 'paid' and 'refunded' are reserved for Module 11+ (Payments).
 */
export type OrderActiveStatus =
  | 'payment_pending'
  | 'accepted'
  | 'in_progress'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

/**
 * Payment statuses actively used in Module 10.
 * 'paid', 'failed', 'refunded', 'partially_refunded' are reserved for Module 11.
 */
export type PaymentActiveStatus = 'created' | 'pending';

export interface Order {
  id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  custom_order_id: string | null;
  amount: number;
  platform_fee: number;
  seller_amount: number;
  currency: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_status: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Order with denormalized display fields for dashboards. */
export interface OrderWithDetails extends Order {
  buyer_full_name: string | null;
  buyer_username: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  listing_title: string | null;
  custom_order_title: string | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Input types (canonical — do not re-declare in validators/order.ts)
// ---------------------------------------------------------------------------

/** Input from the client to create an order from an approved listing. */
export interface CreateListingOrderInput {
  listingId: string;
}

/** Input from the client to create an order from an accepted custom order. */
export interface CreateCustomOrderOrderInput {
  customOrderId: string;
}

/** Input from the client to update an order's status. */
export interface OrderStatusUpdateInput {
  orderId: string;
  action:
    | 'cancel'
    | 'mark_accepted'
    | 'mark_in_progress'
    | 'mark_shipped'
    | 'mark_delivered'
    | 'mark_completed'
    | 'mark_disputed';
  note?: string;
}

export interface OrderListParams {
  status?: OrderActiveStatus;
  paymentStatus?: PaymentStatus;
  page?: number;
}
