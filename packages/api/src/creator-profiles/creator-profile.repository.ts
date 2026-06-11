import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorProfile, CreatorProfileWithCategory } from '@rosovia/core';

export interface ListCreatorProfilesParams {
  limit?: number;
  offset?: number;
}

/**
 * Fetches a creator profile by the owning profile's id (profiles.id, not auth_user_id).
 */
export async function getCreatorProfileByUserId(
  supabase: SupabaseClient,
  profileId: string
): Promise<CreatorProfile | null> {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', profileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch creator profile: ${error.message}`);
  }
  return data as CreatorProfile;
}

/**
 * Fetches a public creator profile by slug. Returns null if not found or deleted.
 */
export async function getCreatorProfileBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<CreatorProfileWithCategory | null> {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select(`
      *,
      categories ( name, slug ),
      profiles!inner ( username, status, deleted_at )
    `)
    .eq('slug', slug)
    .is('deleted_at', null)
    .eq('profiles.status', 'active')
    .is('profiles.deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch creator profile by slug: ${error.message}`);
  }

  // Flatten joined category fields
  const row = data as (CreatorProfile & { categories: { name: string; slug: string } | null; profiles: { username: string | null } | null });
  return {
    ...row,
    category_name: row.categories?.name ?? null,
    category_slug: row.categories?.slug ?? null,
    profile_username: row.profiles?.username ?? null,
  };
}

/**
 * Checks whether a slug is already in use (including deleted profiles).
 */
export async function isSlugTaken(supabase: SupabaseClient, slug: string): Promise<boolean> {
  const { data } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('slug', slug)
    .single();
  return !!data;
}

/**
 * Creates a new creator profile row.
 */
export async function createCreatorProfile(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    display_name: string;
    slug: string;
    bio?: string | null;
    story?: string | null;
    primary_category_id?: string | null;
    skills: string[];
    languages: string[];
    city?: string | null;
    state?: string | null;
    country: string;
    profile_image_url?: string | null;
    intro_video_url?: string | null;
    cover_image_url?: string | null;
    headline?: string | null;
    website_url?: string | null;
    profile_theme?: string | null;
    accepts_custom_orders?: boolean;
    custom_order_description?: string | null;
    custom_order_starting_price?: number | null;
    custom_order_delivery_days?: number | null;
  }
): Promise<CreatorProfile> {
  const { data: created, error } = await supabase
    .from('creator_profiles')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create creator profile: ${error.message}`);
  return created as CreatorProfile;
}

/**
 * Updates an existing creator profile row.
 * Sensitive fields (verification, rating, counters) are intentionally excluded
 * from the data parameter — enforced by the service layer.
 */
export async function updateCreatorProfile(
  supabase: SupabaseClient,
  id: string,
  data: {
    display_name?: string;
    bio?: string | null;
    story?: string | null;
    primary_category_id?: string | null;
    skills?: string[];
    languages?: string[];
    city?: string | null;
    state?: string | null;
    country?: string;
    profile_image_url?: string | null;
    intro_video_url?: string | null;
    cover_image_url?: string | null;
    headline?: string | null;
    website_url?: string | null;
    profile_theme?: string | null;
    accepts_custom_orders?: boolean;
    custom_order_description?: string | null;
    custom_order_starting_price?: number | null;
    custom_order_delivery_days?: number | null;
  }
): Promise<CreatorProfile> {
  const { data: updated, error } = await supabase
    .from('creator_profiles')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update creator profile: ${error.message}`);
  return updated as CreatorProfile;
}

export function mapProfileRowToCreatorProfile(row: any): CreatorProfileWithCategory {
  const cpRaw = row.creator_profiles;
  const cp = Array.isArray(cpRaw) ? cpRaw[0] : cpRaw;
  const cat = cp?.categories;

  return {
    id: cp?.id ?? row.id,
    user_id: row.id,
    display_name: row.full_name || row.username || 'Anonymous',
    slug: cp?.slug ?? (row.username || row.id),
    bio: row.bio ?? cp?.bio ?? null,
    story: cp?.story ?? null,
    primary_category_id: cp?.primary_category_id ?? null,
    skills: cp?.skills ?? [],
    languages: cp?.languages ?? [],
    city: row.city ?? cp?.city ?? null,
    state: row.state ?? cp?.state ?? null,
    country: row.country ?? cp?.country ?? 'India',
    profile_image_url: row.avatar_url ?? cp?.profile_image_url ?? null,
    intro_video_url: cp?.intro_video_url ?? null,
    verification_level: cp?.verification_level ?? 'none',
    is_verified: cp?.is_verified ?? false,
    rating_avg: cp?.rating_avg ?? 0,
    rating_count: cp?.rating_count ?? 0,
    total_orders: cp?.total_orders ?? 0,
    total_followers: cp?.total_followers ?? 0,
    cover_image_url: row.cover_image_url ?? cp?.cover_image_url ?? null,
    headline: cp?.headline ?? null,
    website_url: cp?.website_url ?? null,
    profile_theme: cp?.profile_theme ?? 'default',
    accepts_custom_orders: cp?.accepts_custom_orders ?? true,
    custom_order_description: cp?.custom_order_description ?? null,
    custom_order_starting_price: cp?.custom_order_starting_price !== undefined ? Number(cp.custom_order_starting_price) : null,
    custom_order_delivery_days: cp?.custom_order_delivery_days ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    category_name: cat?.name ?? null,
    category_slug: cat?.slug ?? null,
    profile_username: row.username ?? null,
    role: row.role ?? null,
  } as any;
}

/**
 * Lists public (non-deleted) creator profiles, joined with category name.
 * B1 fix: Inner-joins through profiles to exclude suspended creator accounts.
 */
export async function listPublicCreatorProfiles(
  supabase: SupabaseClient,
  params: ListCreatorProfilesParams = {}
): Promise<CreatorProfileWithCategory[]> {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;

  const { data, error } = await supabase
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
        accepts_custom_orders,
        custom_order_description,
        custom_order_starting_price,
        custom_order_delivery_days,
        categories ( name, slug )
      )
    `)
    .eq('role', 'creator')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list creator profiles: ${error.message}`);

  return (data ?? []).map(mapProfileRowToCreatorProfile);
}

