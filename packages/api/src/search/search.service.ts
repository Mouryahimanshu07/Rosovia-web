import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ListingWithDetails,
  CreatorProfileWithCategory,
  DbCategory,
  PaginatedResult,
} from '@rosovia/core';
import {
  listingSearchParamsSchema,
  creatorSearchParamsSchema,
  categorySearchParamsSchema,
} from '@rosovia/core';
import {
  searchApprovedListings,
  searchPublicCreators,
  listActiveCategories,
  getCategoryBySlug,
  getCategoryPageData,
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
