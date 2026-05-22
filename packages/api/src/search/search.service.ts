import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ListingWithDetails,
  CreatorProfileWithCategory,
  DbCategory,
  PaginatedResult,
  ListingSearchParams,
} from '@rosovia/core';

import {
  listingSearchParamsSchema,
  creatorSearchParamsSchema,
  categorySearchParamsSchema,
} from '@rosovia/core';
import {
  searchApprovedListings,
  searchListingsRanked,
  searchPublicCreators,
  listActiveCategories,
  getCategoryBySlug,
  getCategoryPageData,
  type RankedSearchParams,
} from './search.repository';
import { listPublicListings } from '../listings/listing.repository';
import { listPublicCreatorProfiles } from '../creator-profiles/creator-profile.repository';

// ---------------------------------------------------------------------------
// getExplorePageData
// ---------------------------------------------------------------------------

export async function getExplorePageData(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<{
  categories: DbCategory[];
  listings: PaginatedResult<ListingWithDetails>;
  creators: CreatorProfileWithCategory[];
  q: string;
}> {
  const q = typeof rawParams.q === 'string' ? rawParams.q.trim() : '';

  const [categories, listings, creatorsRaw] = await Promise.all([
    listActiveCategories(supabase),
    q
      ? searchApprovedListings(supabase, { q, page: 1 })
      : listPublicListings(supabase, { limit: 12 }).then((data) => ({
          data,
          meta: { page: 1, pageSize: 12, total: null, hasNext: false, hasPrev: false },
        })),
    listPublicCreatorProfiles(supabase, { limit: 8 }),
  ]);

  return {
    categories,
    listings,
    creators: creatorsRaw,
    q,
  };
}

// ---------------------------------------------------------------------------
// searchListingsForPublicPage
// ---------------------------------------------------------------------------

export async function searchListingsForPublicPage(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<PaginatedResult<ListingWithDetails>> {
  const parsed = listingSearchParamsSchema.safeParse(rawParams);
  const params = parsed.success ? parsed.data : {};
  return searchApprovedListings(supabase, params);
}

// ---------------------------------------------------------------------------
// searchCreatorsForPublicPage
// ---------------------------------------------------------------------------

export async function searchCreatorsForPublicPage(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<PaginatedResult<CreatorProfileWithCategory>> {
  const parsed = creatorSearchParamsSchema.safeParse(rawParams);
  const params = parsed.success ? parsed.data : {};
  return searchPublicCreators(supabase, params);
}

// ---------------------------------------------------------------------------
// getCategoriesPageData
// ---------------------------------------------------------------------------

export async function getCategoriesPageData(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<DbCategory[]> {
  const parsed = categorySearchParamsSchema.safeParse(rawParams);
  const params = parsed.success ? parsed.data : {};
  return listActiveCategories(supabase, params);
}

// ---------------------------------------------------------------------------
// getPublicCategoryDetailPageData
// ---------------------------------------------------------------------------

export async function getPublicCategoryDetailPageData(
  supabase: SupabaseClient,
  slug: string,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<{
  category: DbCategory;
  listings: PaginatedResult<ListingWithDetails>;
  creators: CreatorProfileWithCategory[];
} | null> {
  const category = await getCategoryBySlug(supabase, slug);
  if (!category) return null;

  const parsed = listingSearchParamsSchema.safeParse(rawParams);
  const params = parsed.success ? parsed.data : {};

  const { listings, creators } = await getCategoryPageData(
    supabase,
    category.id,
    params
  );

  return { category, listings, creators };
}

// ---------------------------------------------------------------------------
// getTrendingListings
//
// Returns the top trending listings globally using the blended ranking RPC.
// Used for "Trending" sections on the explore page.
// ---------------------------------------------------------------------------

export async function getTrendingListings(
  supabase: SupabaseClient,
  options: {
    category?: string;
    limit?: number;
    buyerCity?: string;
    buyerState?: string;
  } = {}
): Promise<ListingWithDetails[]> {
  const searchParams: RankedSearchParams = {
    sort: 'trending' as ListingSearchParams['sort'],
    category: options.category,
    buyerCity: options.buyerCity,
    buyerState: options.buyerState,
    page: 1,
  };
  const result = await searchListingsRanked(supabase, searchParams);
  return result.data.slice(0, options.limit ?? 12);
}


// ---------------------------------------------------------------------------
// recordListingView
//
// B4: Persists a listing view event via the record_listing_event() RPC.
// Must be called from a Next.js server action (not client-side) so the
// service_role or authenticated context is available.
// Fails silently — analytics should never block rendering.
// ---------------------------------------------------------------------------

export async function recordListingView(
  supabase: SupabaseClient,
  listingId: string,
  sessionId?: string
): Promise<void> {
  try {
    await supabase.rpc('record_listing_event', {
      p_listing_id:  listingId,
      p_event_type:  'view',
      p_session_id:  sessionId ?? null,
    });
  } catch {
    // Analytics must never throw — log and continue
    console.warn('[analytics] Failed to record listing view:', listingId);
  }
}
