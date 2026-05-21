import type { SupabaseClient } from '@supabase/supabase-js';
import type { Review, ReviewWithDetails, ReviewListParams } from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal: flatten joined row into ReviewWithDetails
// ---------------------------------------------------------------------------

type RawReviewRow = Review & {
  profiles?: { full_name: string | null; username: string | null } | null;
  creator_profiles?: { display_name: string; slug: string } | null;
  listings?: { title: string } | null;
};

function flattenReview(row: RawReviewRow): ReviewWithDetails {
  const buyerName =
    row.profiles?.full_name ??
    row.profiles?.username ??
    null;

  return {
    ...row,
    buyer_display_name: buyerName,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    listing_title: row.listings?.title ?? null,
  };
}

const WITH_DETAILS_SELECT =
  '*, profiles ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title )';

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getReviewById(
  supabase: SupabaseClient,
  id: string
): Promise<ReviewWithDetails | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select(WITH_DETAILS_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch review: ${error.message}`);
  }
  return flattenReview(data as RawReviewRow);
}

export async function getReviewByOrderId(
  supabase: SupabaseClient,
  orderId: string
): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch review by order ID: ${error.message}`);
  return data as Review | null;
}

export async function listReviewsByCreatorId(
  supabase: SupabaseClient,
  creatorId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reviews')
    .select(WITH_DETAILS_SELECT)
    .eq('creator_id', creatorId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.rating) query = query.eq('rating', params.rating);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creator reviews: ${error.message}`);
  return (data ?? []).map((r) => flattenReview(r as RawReviewRow));
}

export async function listReviewsByListingId(
  supabase: SupabaseClient,
  listingId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reviews')
    .select(WITH_DETAILS_SELECT)
    .eq('listing_id', listingId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.rating) query = query.eq('rating', params.rating);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list listing reviews: ${error.message}`);
  return (data ?? []).map((r) => flattenReview(r as RawReviewRow));
}

export async function listCurrentBuyerReviews(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reviews')
    .select(WITH_DETAILS_SELECT)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.rating) query = query.eq('rating', params.rating);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list buyer reviews: ${error.message}`);
  return (data ?? []).map((r) => flattenReview(r as RawReviewRow));
}

export async function listCurrentCreatorReceivedReviews(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reviews')
    .select(WITH_DETAILS_SELECT)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.rating) query = query.eq('rating', params.rating);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creator received reviews: ${error.message}`);
  return (data ?? []).map((r) => flattenReview(r as RawReviewRow));
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function createReview(
  supabase: SupabaseClient,
  data: {
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
  }
): Promise<Review> {
  const { data: created, error } = await supabase
    .from('reviews')
    .insert({
      order_id: data.order_id,
      buyer_id: data.buyer_id,
      creator_id: data.creator_id,
      listing_id: data.listing_id,
      rating: data.rating,
      quality_rating: data.quality_rating,
      communication_rating: data.communication_rating,
      delivery_rating: data.delivery_rating,
      comment: data.comment,
      media_id: data.media_id,
      is_hidden: false,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create review: ${error.message}`);
  return created as Review;
}

export async function updateReviewVisibility(
  supabase: SupabaseClient,
  reviewId: string,
  isHidden: boolean
): Promise<Review> {
  const { data: updated, error } = await supabase
    .from('reviews')
    .update({ is_hidden: isHidden })
    .eq('id', reviewId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update review visibility: ${error.message}`);
  return updated as Review;
}
