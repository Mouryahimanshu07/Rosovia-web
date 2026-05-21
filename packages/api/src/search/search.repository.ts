import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ListingWithDetails,
  CreatorProfileWithCategory,
  DbCategory,
  ListingSearchParams,
  CreatorSearchParams,
  CategorySearchParams,
  PaginatedResult,
} from '@rosovia/core';

const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenListingRow(
  row: ListingWithDetails & {
    categories?: { name: string } | null;
    creator_profiles?: { display_name: string; slug: string } | null;
  }
): ListingWithDetails {
  return {
    ...row,
    category_name: (row.categories as { name: string } | null)?.name ?? row.category_name ?? null,
    creator_display_name: (row.creator_profiles as { display_name: string; slug: string } | null)?.display_name ?? row.creator_display_name ?? null,
    creator_slug: (row.creator_profiles as { display_name: string; slug: string } | null)?.slug ?? row.creator_slug ?? null,
  };
}

function flattenCreatorRow(
  row: CreatorProfileWithCategory & {
    categories?: { name: string; slug: string } | null;
  }
): CreatorProfileWithCategory {
  return {
    ...row,
    category_name: (row.categories as { name: string; slug: string } | null)?.name ?? row.category_name ?? null,
    category_slug: (row.categories as { name: string; slug: string } | null)?.slug ?? row.category_slug ?? null,
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
// ---------------------------------------------------------------------------

export async function searchApprovedListings(
  supabase: SupabaseClient,
  params: ListingSearchParams
): Promise<PaginatedResult<ListingWithDetails>> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to detect hasNext without an expensive COUNT(*)
  const fetchLimit = PAGE_SIZE + 1;

  // Single data query — no separate count query
  let dataQuery = supabase
    .from('listings')
    .select('*, categories(name), creator_profiles!inner(display_name, slug, deleted_at, profiles!inner(status, deleted_at))')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null);

  // Apply filters
  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    dataQuery = dataQuery.or(
      `title.ilike.${term},description.ilike.${term},city.ilike.${term},state.ilike.${term}`
    );
  }
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

  // Sort
  const sort = params.sort ?? 'newest';
  if (sort === 'price_low') {
    dataQuery = dataQuery.order('price', { ascending: true, nullsFirst: false });
  } else if (sort === 'price_high') {
    dataQuery = dataQuery.order('price', { ascending: false, nullsFirst: false });
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
    .from('creator_profiles')
    .select('*, categories(name, slug), profiles!inner(status, deleted_at)')
    .is('deleted_at', null)
    .eq('profiles.status', 'active')
    .is('profiles.deleted_at', null);

  // Apply filters
  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    dataQuery = dataQuery.or(
      `display_name.ilike.${term},bio.ilike.${term},story.ilike.${term},city.ilike.${term},state.ilike.${term}`
    );
  }
  if (params.category) {
    dataQuery = dataQuery.eq('primary_category_id', params.category);
  }
  if (params.city) {
    dataQuery = dataQuery.ilike('city', `%${params.city.trim()}%`);
  }
  if (params.state) {
    dataQuery = dataQuery.ilike('state', `%${params.state.trim()}%`);
  }
  if (params.verifiedOnly === true) {
    dataQuery = dataQuery.eq('is_verified', true);
  }

  // Sort
  const sort = params.sort ?? 'newest';
  if (sort === 'rating_high') {
    dataQuery = dataQuery.order('rating_avg', { ascending: false });
  } else if (sort === 'verified_first') {
    dataQuery = dataQuery
      .order('is_verified', { ascending: false })
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

  const results = pageRows.map((r) =>
    flattenCreatorRow(r as Parameters<typeof flattenCreatorRow>[0])
  );

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
      .select('*, categories(name, slug), profiles!inner(status, deleted_at)')
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
