// Review types for Rosovia Module 12: Reviews

export interface Review {
  id: string;
  order_id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  rating: number;
  quality_rating: number | null;
  communication_rating: number | null;
  delivery_rating: number | null;
  comment: string | null;
  media_id: string | null;
  is_hidden: boolean;
  creator_reply: string | null;
  creator_replied_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Review with denormalized display fields for dashboards and public pages.
 */
export interface ReviewWithDetails extends Review {
  /** Buyer's display name (full_name or username) */
  buyer_display_name: string | null;
  /** Creator's display name */
  creator_display_name: string | null;
  /** Creator's slug — for linking to public profile */
  creator_slug: string | null;
  /** Listing title, if the order was for a specific listing */
  listing_title: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Data the buyer submits to create a review.
 * buyer_id, creator_id, listing_id are derived server-side from the order.
 * is_hidden is always false on creation — admin sets it later.
 */
export interface ReviewCreateInput {
  orderId: string;
  rating: number;
  qualityRating?: number;
  communicationRating?: number;
  deliveryRating?: number;
  comment?: string;
  mediaId?: string;
}

export interface ReviewListParams {
  page?: number;
  rating?: number;
}

/** Breakdown of sub-ratings — useful for display aggregation. */
export interface ReviewRatingBreakdown {
  quality_avg: number | null;
  communication_avg: number | null;
  delivery_avg: number | null;
  total_count: number;
}

/** Input for admin review visibility toggle. */
export interface AdminReviewVisibilityInput {
  reviewId: string;
  isHidden: boolean;
  note?: string;
}
