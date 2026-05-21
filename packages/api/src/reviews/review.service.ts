import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Review,
  ReviewWithDetails,
  ReviewCreateInput,
  ReviewListParams,
  AdminReviewVisibilityInput,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getReviewByOrderId,
  listReviewsByCreatorId,
  listReviewsByListingId,
  listCurrentBuyerReviews,
  listCurrentCreatorReceivedReviews,
  updateReviewVisibility,
} from './review.repository';

export {
  getReviewByOrderId,
  listReviewsByCreatorId,
  listReviewsByListingId,
};

// ---------------------------------------------------------------------------
// Internal: resolve active profile from auth session
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// Buyer: create a review after a completed, paid order
//
// Critical business rules (buyer identity, order completed, payment paid,
// duplicate prevention) are enforced atomically in the database by
// public.create_review_for_completed_order_atomic (migration 021).
//
// The mediaId ownership check is kept here because it is a cross-table guard
// unrelated to the order lifecycle and is not easily verified inside a
// security-definer RPC without extra joins.
// ---------------------------------------------------------------------------

export async function createCurrentBuyerReview(
  supabase: SupabaseClient,
  input: ReviewCreateInput
): Promise<Review> {
  // Check mediaId ownership before hitting the RPC, so errors surface clearly.
  if (input.mediaId) {
    const profile = await resolveActiveProfile(supabase);

    const { data: mediaRow, error: mediaError } = await supabase
      .from('media_assets')
      .select('id, uploaded_by')
      .eq('id', input.mediaId)
      .is('deleted_at', null)
      .single();

    if (mediaError || !mediaRow) {
      throw new Error('Media asset not found');
    }

    const media = mediaRow as { id: string; uploaded_by: string };
    if (media.uploaded_by !== profile.id) {
      throw new Error('Media asset does not belong to you');
    }
  }

  // Delegate all critical validation + INSERT atomically to the DB function.
  // Narrow cast required: migration 021 RPCs are not yet reflected in
  // database.types.ts. Remove this cast once types are regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    'create_review_for_completed_order_atomic',
    {
      p_order_id: input.orderId,
      p_rating: input.rating,
      p_comment: input.comment?.trim() ?? null,
      p_quality_rating: input.qualityRating ?? null,
      p_communication_rating: input.communicationRating ?? null,
      p_delivery_rating: input.deliveryRating ?? null,
      p_media_id: input.mediaId ?? null,
    }
  ) as { data: Review | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Review creation failed');
  }

  // Rating aggregation is performed automatically by the DB trigger.
  return data;
}

// ---------------------------------------------------------------------------
// Public: visible reviews for a creator profile
// ---------------------------------------------------------------------------

export async function listReviewsForPublicCreator(
  supabase: SupabaseClient,
  creatorId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  return listReviewsByCreatorId(supabase, creatorId, params);
}

// ---------------------------------------------------------------------------
// Public: visible reviews for a listing
// ---------------------------------------------------------------------------

export async function listReviewsForPublicListing(
  supabase: SupabaseClient,
  listingId: string,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  return listReviewsByListingId(supabase, listingId, params);
}

// ---------------------------------------------------------------------------
// Buyer: list own submitted reviews
// ---------------------------------------------------------------------------

export async function listBuyerReviewsForCurrentUser(
  supabase: SupabaseClient,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentBuyerReviews(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// Creator: list reviews received on their creator profile
// ---------------------------------------------------------------------------

export async function listCreatorReviewsForCurrentUser(
  supabase: SupabaseClient,
  params: ReviewListParams = {}
): Promise<ReviewWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'creator') {
    throw new Error('Only creators can access the creator reviews dashboard');
  }

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) {
    throw new Error(
      'Creator profile not found. Please complete your creator profile first.'
    );
  }

  return listCurrentCreatorReceivedReviews(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Admin: hide or unhide a review (service-level only — no UI in Module 12)
// ---------------------------------------------------------------------------

export async function hideReviewAsAdmin(
  supabase: SupabaseClient,
  input: AdminReviewVisibilityInput
): Promise<Review> {
  // Admin check: enforced by RLS on UPDATE, double-checked here for clarity.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return updateReviewVisibility(supabase, input.reviewId, input.isHidden);
}
