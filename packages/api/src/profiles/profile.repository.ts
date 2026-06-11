import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@rosovia/core';

/**
 * Fetches a profile by auth_user_id.
 * Returns null if no profile exists.
 */
export async function getProfileByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .single();

  if (error) {
    // No rows found — not a hard error
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Creates a new profile row for an authenticated user.
 * Respects RLS: only the user themselves can insert.
 */
export async function createProfileForAuthUser(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    username?: string | null;
    role: 'buyer' | 'creator';
  }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: params.authUserId,
      email: params.email,
      full_name: params.fullName,
      username: params.username ?? null,
      role: params.role,
      country: 'India',
      status: 'active',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Updates a profile's status (e.g. suspending a user).
 */
export async function updateProfileStatus(
  supabase: SupabaseClient,
  profileId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to update profile status: ${error.message}`);
  }
}

/**
 * Fetches a profile by its unique username.
 * Returns null if not found.
 */
export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch profile by username: ${error.message}`);
  return data as Profile | null;
}

/**
 * Updates an authenticated user's base profile fields.
 * Direct RLS matches authUserId.
 */
export async function updateProfileByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string,
  data: Partial<{
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    cover_image_url: string | null;
    bio: string | null;
    city: string | null;
    state: string | null;
    country: string;
    language: string | null;
  }>
): Promise<Profile> {
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('auth_user_id', authUserId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update user profile: ${error.message}`);
  return updated as Profile;
}

/**
 * Lists public (non-deleted, active) profiles from the public_profiles view.
 */
export async function listPublicProfiles(
  supabase: SupabaseClient,
  params: { limit?: number; offset?: number } = {}
): Promise<Profile[]> {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list public profiles: ${error.message}`);
  return data as Profile[];
}

