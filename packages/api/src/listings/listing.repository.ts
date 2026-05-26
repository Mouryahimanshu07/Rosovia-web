import type { SupabaseClient } from '@supabase/supabase-js';
import type { Listing, ListingWithDetails, ListingStatus, VerificationLevel } from '@rosovia/core';

export interface ListListingsParams {
  limit?: number;
  offset?: number;
}

function flattenListing(
  row: Listing & {
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
    category_name: row.categories?.name ?? null,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    creator_is_verified: row.creator_profiles?.is_verified ?? false,
    creator_verification_level: row.creator_profiles?.verification_level ?? 'none',
    creator_rating_avg: row.creator_profiles?.rating_avg ?? 0,
    creator_rating_count: row.creator_profiles?.rating_count ?? 0,
  };
}

export async function getListingById(
  supabase: SupabaseClient,
  id: string
): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch listing: ${error.message}`);
  }
  return data as Listing;
}

export async function getListingBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<ListingWithDetails | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, categories ( name ), creator_profiles ( display_name, slug, is_verified, verification_level, rating_avg, rating_count )')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch listing by slug: ${error.message}`);
  }
  return flattenListing(data as Parameters<typeof flattenListing>[0]);
}

export async function isListingSlugTaken(
  supabase: SupabaseClient,
  slug: string
): Promise<boolean> {
  const { data } = await supabase
    .from('listings')
    .select('id')
    .eq('slug', slug)
    .single();
  return !!data;
}

export async function listPublicListings(
  supabase: SupabaseClient,
  params: ListListingsParams = {}
): Promise<ListingWithDetails[]> {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;

  const { data, error } = await supabase
    .from('listings')
    .select('*, categories ( name ), creator_profiles!inner ( display_name, slug, is_verified, verification_level, rating_avg, rating_count, deleted_at, profiles!inner(status, deleted_at) )')
    .eq('status', 'approved')
    .is('deleted_at', null)
    // B1 fix: ensure creator is not deleted and their account is active
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list public listings: ${error.message}`);
  return (data ?? []).map((r) => flattenListing(r as Parameters<typeof flattenListing>[0]));
}

export async function listCreatorPublicListings(
  supabase: SupabaseClient,
  creatorId: string,
  params: ListListingsParams = {}
): Promise<ListingWithDetails[]> {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;

  const { data, error } = await supabase
    .from('listings')
    .select('*, categories ( name ), creator_profiles!inner ( display_name, slug, is_verified, verification_level, rating_avg, rating_count, deleted_at, profiles!inner(status, deleted_at) )')
    .eq('creator_id', creatorId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list creator public listings: ${error.message}`);
  return (data ?? []).map((r) => flattenListing(r as Parameters<typeof flattenListing>[0]));
}

export async function listCurrentCreatorListings(
  supabase: SupabaseClient,
  creatorProfileId: string
): Promise<ListingWithDetails[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, categories ( name )')
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list creator listings: ${error.message}`);
  return (data ?? []).map((r) =>
    flattenListing({
      ...(r as Listing & { categories?: { name: string } | null }),
      creator_profiles: null,
    })
  );
}

export async function createListing(
  supabase: SupabaseClient,
  data: {
    creator_id: string;
    category_id: string;
    listing_type: string;
    title: string;
    slug: string;
    description?: string | null;
    price?: number | null;
    currency: string;
    stock?: number | null;
    city?: string | null;
    state?: string | null;
    custom_order_available: boolean;
    delivery_available: boolean;
    online_available: boolean;
    offline_available: boolean;
    metadata: Record<string, unknown>;
  }
): Promise<Listing> {
  const { data: created, error } = await supabase
    .from('listings')
    .insert({ ...data, status: 'draft', verification_status: 'unverified' })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create listing: ${error.message}`);
  return created as Listing;
}

export async function updateListing(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    category_id: string;
    listing_type: string;
    title: string;
    description: string | null;
    price: number | null;
    currency: string;
    stock: number | null;
    city: string | null;
    state: string | null;
    custom_order_available: boolean;
    delivery_available: boolean;
    online_available: boolean;
    offline_available: boolean;
    metadata: Record<string, unknown>;
  }>
): Promise<Listing> {
  const { data: updated, error } = await supabase
    .from('listings')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update listing: ${error.message}`);
  return updated as Listing;
}

export async function updateListingStatus(
  supabase: SupabaseClient,
  id: string,
  status: ListingStatus
): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update listing status: ${error.message}`);
  return data as Listing;
}

export async function softDeleteListing(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to soft delete listing: ${error.message}`);
}
