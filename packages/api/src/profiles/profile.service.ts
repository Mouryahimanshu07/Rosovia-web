import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@rosovia/core';
import { getProfileByAuthUserId, createProfileForAuthUser } from './profile.repository';

/**
 * Ensures a profile row exists for the authenticated user.
 * Idempotent: safe to call on every login/callback.
 *
 * 1. Fetches existing profile.
 * 2. If found, returns it.
 * 3. If not found, reads metadata and creates one with role buyer/creator only.
 * 4. Never creates admin from public metadata.
 */
export async function ensureUserProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Try to fetch existing profile
  let profile = await getProfileByAuthUserId(supabase, user.id);
  if (profile) return profile;

  // Extract safe fields from user metadata — never trust admin from metadata
  const metadata = user.user_metadata ?? {};
  const rawRole = metadata['role'] as string | undefined;
  const safeRole: 'buyer' | 'creator' = rawRole === 'creator' ? 'creator' : 'buyer';

  // Create profile
  profile = await createProfileForAuthUser(supabase, {
    authUserId: user.id,
    email: user.email ?? null,
    fullName: (metadata['full_name'] as string | undefined) ?? null,
    username: (metadata['username'] as string | undefined) ?? null,
    role: safeRole,
  });

  return profile;
}

/**
 * Returns the current authenticated user's profile.
 * Returns null if unauthenticated or profile not found.
 */
export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getProfileByAuthUserId(supabase, user.id);
}

/**
 * Returns the dashboard path for a given role.
 */
export function getDashboardRedirectPath(role: Profile['role']): string {
  switch (role) {
    case 'admin':
      return '/dashboard/admin';
    case 'creator':
      return '/dashboard/creator';
    case 'buyer':
    default:
      return '/dashboard/buyer';
  }
}
