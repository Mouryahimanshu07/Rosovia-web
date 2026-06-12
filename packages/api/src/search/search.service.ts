import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ListingWithDetails,
  CreatorProfileWithCategory,
  DbCategory,
  PaginatedResult,
  ListingSearchParams,
  CreatorPostWithDetails,
  Profile,
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
  searchPublicProfiles,
  type RankedSearchParams,
} from './search.repository';
import { listPublicListings } from '../listings/listing.repository';
import { listPublicCreatorProfiles } from '../creator-profiles/creator-profile.repository';
import { listPublicWorkFeedPosts } from '../posts/post.repository';
import { listPublicProfiles } from '../profiles/profile.repository';

// ---------------------------------------------------------------------------
// getExplorePageData — extended with work feed
// ---------------------------------------------------------------------------

export async function getExplorePageData(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {},
  viewerProfileId?: string | null
): Promise<{
  categories: DbCategory[];
  listings: PaginatedResult<ListingWithDetails>;
  creators: CreatorProfileWithCategory[];
  people: Profile[];
  workFeed: { data: CreatorPostWithDetails[]; hasNext: boolean };
  q: string;
}> {
  const q = typeof rawParams.q === 'string' ? rawParams.q.trim() : '';

  const pageVal = Array.isArray(rawParams.page) ? rawParams.page[0] : rawParams.page;
  const page = pageVal ? parseInt(pageVal, 10) : 1;

  const sortVal = Array.isArray(rawParams.sort) ? rawParams.sort[0] : rawParams.sort;
  const sort = sortVal || 'newest';

  const categoryVal = Array.isArray(rawParams.category) ? rawParams.category[0] : rawParams.category;
  const category = categoryVal || undefined;

  const postTypeVal = Array.isArray(rawParams.postType) ? rawParams.postType[0] : rawParams.postType;
  const postType = postTypeVal || undefined;

  const [categories, listings, creatorsRaw, people, workFeed] = await Promise.all([
    listActiveCategories(supabase, {}),
    (q || category)
      ? searchApprovedListings(supabase, { q, category, page: 1 })
      : listPublicListings(supabase, { limit: 12 }).then((data) => ({
          data,
          meta: { page: 1, pageSize: 12, total: null, hasNext: false, hasPrev: false },
        })),
    (q || category)
      ? searchPublicCreators(supabase, { q, category }).then((res) => res.data)
      : listPublicCreatorProfiles(supabase, { limit: 12 }),
    q
      ? searchPublicProfiles(supabase, { q, limit: 12 }).then((res) => res.data)
      : listPublicProfiles(supabase, { limit: 12 }),
    listPublicWorkFeedPosts(
      supabase,
      {
        page,
        sort: sort as any,
        category,
        postType: postType as any,
        type: (rawParams.type as any) || undefined,
        verified: rawParams.verified === 'true' || (rawParams.verified as any) === true || undefined,
        ...(q ? { q } : {}),
      },
      viewerProfileId
    ),
  ]);

  return {
    categories,
    listings,
    creators: creatorsRaw,
    people,
    workFeed,
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
