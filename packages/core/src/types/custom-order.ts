// Custom Order types for Rosovia Module 9: Custom Orders

export type CustomOrderStatus =
  | 'requested'
  | 'creator_reviewing'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'payment_pending'
  | 'paid'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed';

/** The statuses actively used in Module 9 UI flows. */
export type CustomOrderActiveStatus =
  | 'requested'
  | 'creator_reviewing'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface CustomOrder {
  id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  category_id: string;
  title: string;
  description: string;
  reference_media_id: string | null;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  creator_quote_amount: number | null;
  creator_quote_note: string | null;
  status: CustomOrderStatus;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** CustomOrder with denormalized display names for dashboards. */
export interface CustomOrderWithDetails extends CustomOrder {
  buyer_full_name: string | null;
  buyer_username: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  listing_title: string | null;
  category_name: string | null;
}

export interface CustomOrderListParams {
  status?: CustomOrderActiveStatus;
  page?: number;
}
