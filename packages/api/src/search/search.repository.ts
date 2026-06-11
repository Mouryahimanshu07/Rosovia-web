import type { SupabaseClient } from '@supabase/supabase-js';
import { mapProfileRowToCreatorProfile } from '../creator-profiles/creator-profile.repository';
import type {
  ListingWithDetails,
  CreatorProfileWithCategory,
  DbCategory,
  ListingSearchParams,
  CreatorSearchParams,
  CategorySearchParams,
  PaginatedResult,
  VerificationLevel,
  Profile,
} from '@rosovia/core';

const PAGE_SIZE = 12;

// Internal extension of ListingSearchParams for the ranked RPC.
// buyerCity/buyerState are passed by the service layer from session context;
// they are NOT exposed as URL query params.
export interface RankedSearchParams extends ListingSearchParams {
  buyerCity?: string;
  buyerState?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenListingRow(
  row: ListingWithDetails & {
    categories?: { name: string } | null;
    creator_profiles?: {
      display_name: string;
      slug: string;
      is_verified?: boolean;
      verification_level?: VerificationLevel;
      rating_avg?: number;
      rating_count?: number;
    } | null;
  }
): ListingWithDetails {
  return {
    ...row,
    category_name: (row.categories as { name: string } | null)?.name ?? row.category_name ?? null,
    creator_display_name: (row.creator_profiles as { display_name: string; slug: string } | null)?.display_name ?? row.creator_display_name ?? null,
    creator_slug: (row.creator_profiles as { display_name: string; slug: string } | null)?.slug ?? row.creator_slug ?? null,
    creator_is_verified: row.creator_profiles?.is_verified ?? false,
    creator_verification_level: row.creator_profiles?.verification_level ?? 'none',
    creator_rating_avg: row.creator_profiles?.rating_avg ?? 0,
    creator_rating_count: row.creator_profiles?.rating_count ?? 0,
  };
}

function flattenCreatorRow(
  row: CreatorProfileWithCategory & {
    categories?: { name: string; slug: string } | null;
    profiles?: { username: string | null } | null;
  }
): CreatorProfileWithCategory {
  return {
    ...row,
    category_name: (row.categories as { name: string; slug: string } | null)?.name ?? row.category_name ?? null,
    category_slug: (row.categories as { name: string; slug: string } | null)?.slug ?? row.category_slug ?? null,
    profile_username: row.profiles?.username ?? row.profile_username ?? null,
  };
}

/**
 * Build pagination metadata using the limit+1 trick:
 * fetch pageSize+1 rows, return pageSize rows, hasNext = got extra row.
 * total is always null (no expensive COUNT(*)); UI uses hasNext for paging.
 */
function buildPaginationMeta(
  page: number,
  pageSize: number,
  rawLength: number
) {
  const hasNext = rawLength > pageSize;
  return {
    page,
    pageSize,
    total: null as null,
    hasNext,
    hasPrev: page > 1,
  };
}

// ---------------------------------------------------------------------------
// searchApprovedListings
//
// Primary listing search using the Supabase PostgREST client.
// Handles all sort modes except 'relevance' and 'trending', which are
// delegated to searchListingsRanked() (the Postgres RPC with blended scoring).
// ---------------------------------------------------------------------------

export async function searchApprovedListings(
  supabase: SupabaseClient,
  params: ListingSearchParams
): Promise<PaginatedResult<ListingWithDetails>> {
  // Delegate relevance + trending sorts to the ranked RPC — richer scoring
  const sortValue = params.sort as string | undefined;
  if (sortValue === 'relevance' || sortValue === 'trending') {
    return searchListingsRanked(supabase, params);
  }
  // When a query is present, also use the ranked RPC for relevance scoring
  if (params.q && params.q.trim().length > 0) {
    return searchListingsRanked(supabase, { ...params, sort: 'relevance' as ListingSearchParams['sort'] });
  }

  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to detect hasNext without an expensive COUNT(*)
  const fetchLimit = PAGE_SIZE + 1;

  // Single data query — no separate count query
  let dataQuery = supabase
    .from('listings')
    .select('*, categories(name), creator_profiles!inner(display_name, slug, is_verified, verification_level, rating_avg, rating_count, deleted_at, profiles!inner(status, deleted_at))')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null);

  // Apply filters
  if (params.category) {
    dataQuery = dataQuery.eq('category_id', params.category);
  }
  if (params.listingType) {
    dataQuery = dataQuery.eq('listing_type', params.listingType);
  }
  if (params.minPrice !== undefined) {
    dataQuery = dataQuery.gte('price', params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    dataQuery = dataQuery.lte('price', params.maxPrice);
  }
  if (params.city) {
    dataQuery = dataQuery.ilike('city', `%${params.city.trim()}%`);
  }
  if (params.state) {
    dataQuery = dataQuery.ilike('state', `%${params.state.trim()}%`);
  }
  if (params.customOrderAvailable === true) {
    dataQuery = dataQuery.eq('custom_order_available', true);
  }
  if (params.onlineAvailable === true) {
    dataQuery = dataQuery.eq('online_available', true);
  }
  if (params.offlineAvailable === true) {
    dataQuery = dataQuery.eq('offline_available', true);
  }
  // B2 fix: verifiedOnly filter was accepted by Zod schema but never applied
  if (params.verifiedOnly === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataQuery = (dataQuery as any).eq('creator_profiles.is_verified', true);
  }

  // Sort
  const sort = params.sort as string | undefined;
  if (sort === 'price_low') {
    dataQuery = dataQuery.order('price', { ascending: true, nullsFirst: false });
  } else if (sort === 'price_high') {
    dataQuery = dataQuery.order('price', { ascending: false, nullsFirst: false });
  } else if (sort === 'rating_high') {
    // ST-2: rating_high sort for listings — sort by creator's rating_avg
    dataQuery = dataQuery
      .order('creator_profiles.rating_avg', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  }

  dataQuery = dataQuery.range(offset, offset + fetchLimit - 1);

  const { data, error } = await dataQuery;

  if (error) throw new Error(`Failed to search listings: ${error.message}`);

  const raw = data ?? [];
  // Trim to actual page size — extra row is only used for hasNext detection
  const pageRows = raw.slice(0, PAGE_SIZE);

  const results = pageRows.map((r) =>
    flattenListingRow(r as Parameters<typeof flattenListingRow>[0])
  );

  return {
    data: results,
    meta: buildPaginationMeta(page, PAGE_SIZE, raw.length),
  };
}

// ---------------------------------------------------------------------------
// searchListingsRanked
//
// Calls the search_listings_ranked() Postgres RPC for blended scoring:
//   - Full-text search via tsvector (stemmed, phrase-aware)
//   - Trigram fuzzy fallback for typo tolerance
//   - trending_score from listing_signals materialized view
//   - Location-affinity and verified-creator boosts
//
// Used automatically when sort='relevance', sort='trending', or when a
// query term is present (to ensure results are relevance-ranked).
// ---------------------------------------------------------------------------

export async function searchListingsRanked(
  supabase: SupabaseClient,
  params: RankedSearchParams
): Promise<PaginatedResult<ListingWithDetails>> {
  const page = params.page ?? 1;

  const { data, error } = await supabase.rpc('search_listings_ranked', {
    p_query:         params.q?.trim() || null,
    p_category:      params.category ?? null,
    p_listing_type:  params.listingType ?? null,
    p_min_price:     params.minPrice ?? null,
    p_max_price:     params.maxPrice ?? null,
    p_city:          params.city?.trim() ?? null,
    p_state:         params.state?.trim() ?? null,
    p_buyer_city:    params.buyerCity?.trim() ?? null,
    p_buyer_state:   params.buyerState?.trim() ?? null,
    p_custom_order:  params.customOrderAvailable ?? null,
    p_online:        params.onlineAvailable ?? null,
    p_offline:       params.offlineAvailable ?? null,
    p_verified_only: params.verifiedOnly ?? null,
    p_sort:          (params.sort as string | undefined) ?? 'relevance',
    p_page:          page,
    p_page_size:     PAGE_SIZE,
  });

  if (error) {
    // Graceful degradation: if the RPC is unavailable (e.g. migration not yet applied),
    // fall back to the basic ILIKE search with relevance ordering disabled
    console.warn('[search] RPC search_listings_ranked unavailable, falling back to ILIKE:', error.message);
    return searchListingsFallback(supabase, params);
  }

  const raw = (data ?? []) as ListingWithDetails[];
  const hasNext = raw.length > PAGE_SIZE;
  const pageRows = raw.slice(0, PAGE_SIZE);

  return {
    data: pageRows,
    meta: {
      page,
      pageSize: PAGE_SIZE,
      total: null,
      hasNext,
      hasPrev: page > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// searchListingsFallback
//
// ST-3: Fuzzy fallback used when:
//   a) The ranked RPC is unavailable
//   b) A text search returns 0 results (zero-result recovery)
//
// Uses ILIKE with trigram GIN indexes. If that also returns 0 results,
// the function returns an empty paginated result rather than an error.
// ---------------------------------------------------------------------------

async function searchListingsFallback(
  supabase: SupabaseClient,
  params: ListingSearchParams
): Promise<PaginatedResult<ListingWithDetails>> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  const fetchLimit = PAGE_SIZE + 1;

  let dataQuery = supabase
    .from('listings')
    .select('*, categories(name), creator_profiles!inner(display_name, slug, is_verified, verification_level, rating_avg, rating_count, deleted_at, profiles!inner(status, deleted_at))')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null);

  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    dataQuery = dataQuery.or(
      `title.ilike.${term},description.ilike.${term},city.ilike.${term},state.ilike.${term}`
    );
  }
  if (params.category) {
    dataQuery = dataQuery.eq('category_id', params.category);
  }
  if (params.minPrice !== undefined) dataQuery = dataQuery.gte('price', params.minPrice);
  if (params.maxPrice !== undefined) dataQuery = dataQuery.lte('price', params.maxPrice);
  if (params.verifiedOnly === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataQuery = (dataQuery as any).eq('creator_profiles.is_verified', true);
  }

  dataQuery = dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  const { data, error } = await dataQuery;
  if (error) throw new Error(`Failed to search listings (fallback): ${error.message}`);

  const raw = data ?? [];
  const pageRows = raw.slice(0, PAGE_SIZE);
  const results = pageRows.map((r) =>
    flattenListingRow(r as Parameters<typeof flattenListingRow>[0])
  );

  return {
    data: results,
    meta: buildPaginationMeta(page, PAGE_SIZE, raw.length),
  };
}

// ---------------------------------------------------------------------------
// searchPublicCreators
// ---------------------------------------------------------------------------

export async function searchPublicCreators(
  supabase: SupabaseClient,
  params: CreatorSearchParams
): Promise<PaginatedResult<CreatorProfileWithCategory>> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to detect hasNext without an expensive COUNT(*)
  const fetchLimit = PAGE_SIZE + 1;

  // Single data query — no separate count query
  let dataQuery = supabase
    .from('public_profiles')
    .select(`
      id,
      full_name,
      username,
      avatar_url,
      cover_image_url,
      bio,
      role,
      city,
      state,
      country,
      created_at,
      updated_at,
      creator_profiles (
        id,
        slug,
        is_verified,
        verification_level,
        rating_avg,
        rating_count,
        total_orders,
        total_followers,
        headline,
        website_url,
        profile_theme,
        categories ( name, slug )
      )
    `)
    .eq('role', 'creator');

  // Apply filters
  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    dataQuery = dataQuery.or(
      `full_name.ilike.${term},username.ilike.${term},bio.ilike.${term},city.ilike.${term},state.ilike.${term}`
    );
  }
  if (params.category) {
    dataQuery = dataQuery.eq('creator_profiles.primary_category_id', params.category);
  }
  if (params.city) {
    dataQuery = dataQuery.ilike('city', `%${params.city.trim()}%`);
  }
  if (params.state) {
    dataQuery = dataQuery.ilike('state', `%${params.state.trim()}%`);
  }
  if (params.verifiedOnly === true) {
    dataQuery = dataQuery.eq('creator_profiles.is_verified', true);
  }

  // Sort
  const sort = params.sort ?? 'newest';
  if (sort === 'rating_high') {
    dataQuery = dataQuery.order('creator_profiles(rating_avg)', { ascending: false, nullsFirst: false });
  } else if (sort === 'verified_first') {
    dataQuery = dataQuery
      .order('creator_profiles(is_verified)', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  }

  dataQuery = dataQuery.range(offset, offset + fetchLimit - 1);

  const { data, error } = await dataQuery;

  if (error) throw new Error(`Failed to search creators: ${error.message}`);

  const raw = data ?? [];
  // Trim to actual page size — extra row is only used for hasNext detection
  const pageRows = raw.slice(0, PAGE_SIZE);

  // Filter in-memory to match PostgREST joined-filter semantics
  const filteredRows = pageRows.filter((r: any) => {
    const cpRaw = r.creator_profiles;
    const cp = Array.isArray(cpRaw) ? cpRaw[0] : cpRaw;

    if (!cp) {
      if (params.category || params.verifiedOnly) {
        return false;
      }
      return true;
    }

    if (params.category && cp.primary_category_id !== params.category) {
      return false;
    }
    if (params.verifiedOnly && !cp.is_verified) {
      return false;
    }
    return true;
  });

  const results = filteredRows.map(mapProfileRowToCreatorProfile);

  return {
    data: results,
    meta: buildPaginationMeta(page, PAGE_SIZE, raw.length),
  };
}

// ---------------------------------------------------------------------------
// listActiveCategories
// ---------------------------------------------------------------------------

export async function listActiveCategories(
  supabase: SupabaseClient,
  params: CategorySearchParams = {}
): Promise<DbCategory[]> {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term},slug.ilike.${term}`);
  }
  if (params.type) {
    query = query.eq('type', params.type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list categories: ${error.message}`);
  return (data ?? []) as DbCategory[];
}

// ---------------------------------------------------------------------------
// getCategoryBySlug
// ---------------------------------------------------------------------------

export async function getCategoryBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<DbCategory | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch category: ${error.message}`);
  }
  return data as DbCategory;
}

// ---------------------------------------------------------------------------
// getCategoryPageData — listings + creators for a category detail page
// ---------------------------------------------------------------------------

export async function getCategoryPageData(
  supabase: SupabaseClient,
  categoryId: string,
  params: ListingSearchParams
): Promise<{
  listings: PaginatedResult<ListingWithDetails>;
  creators: CreatorProfileWithCategory[];
}> {
  const [listings, creatorsResult] = await Promise.all([
    searchApprovedListings(supabase, { ...params, category: categoryId }),
    supabase
      .from('creator_profiles')
      .select('*, categories(name, slug), profiles!inner(username, status, deleted_at)')
      .eq('primary_category_id', categoryId)
      .is('deleted_at', null)
      .eq('profiles.status', 'active')
      .is('profiles.deleted_at', null)
      .order('is_verified', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(12),
  ]);

  const creators = (creatorsResult.data ?? []).map((r) =>
    flattenCreatorRow(r as Parameters<typeof flattenCreatorRow>[0])
  );

  return { listings, creators };
}

/**
 * Searches active public profiles by query string (display_name, username, bio, location).
 */
export async function searchPublicProfiles(
  supabase: SupabaseClient,
  params: { q?: string; page?: number; limit?: number }
): Promise<PaginatedResult<Profile>> {
  const page = params.page ?? 1;
  const pageSize = params.limit ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const fetchLimit = pageSize + 1;

  let query = supabase
    .from('public_profiles')
    .select('*');

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    query = query.or(
      `display_name.ilike.${term},username.ilike.${term},bio.ilike.${term},city.ilike.${term},state.ilike.${term}`
    );
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to search public profiles: ${error.message}`);

  const raw = data ?? [];
  const pageRows = raw.slice(0, pageSize) as Profile[];

  return {
    data: pageRows,
    meta: buildPaginationMeta(page, pageSize, raw.length),
  };
}
