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
