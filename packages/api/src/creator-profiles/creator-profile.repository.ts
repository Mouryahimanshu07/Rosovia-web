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
      categories ( name, slug )
    `)
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch creator profile by slug: ${error.message}`);
  }

  // Flatten joined category fields
  const row = data as (CreatorProfile & { categories: { name: string; slug: string } | null });
  return {
    ...row,
    category_name: row.categories?.name ?? null,
    category_slug: row.categories?.slug ?? null,
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
    .from('creator_profiles')
    .select(`
      *,
      categories ( name, slug ),
      profiles!inner ( status, deleted_at )
    `)
    .is('deleted_at', null)
    // B1 fix: only surface creators whose underlying account is active
    .eq('profiles.status', 'active')
    .is('profiles.deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list creator profiles: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as CreatorProfile & { categories: { name: string; slug: string } | null };
    return {
      ...r,
      category_name: r.categories?.name ?? null,
      category_slug: r.categories?.slug ?? null,
    };
  });
}

