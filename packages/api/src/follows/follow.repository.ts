import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorFollow, ProfileFollow } from '@rosovia/core';

// ---------------------------------------------------------------------------
// Get a specific follow row
// ---------------------------------------------------------------------------

export async function getFollowRow(
  supabase: SupabaseClient,
  followerProfileId: string,
  creatorProfileId: string
): Promise<CreatorFollow | null> {
  const { data, error } = await supabase
    .from('creator_follows')
    .select('*')
    .eq('follower_profile_id', followerProfileId)
    .eq('creator_profile_id', creatorProfileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check follow: ${error.message}`);
  return data as CreatorFollow | null;
}

// ---------------------------------------------------------------------------
// Create follow row
// ---------------------------------------------------------------------------

export async function insertFollow(
  supabase: SupabaseClient,
  followerProfileId: string,
  creatorProfileId: string
): Promise<CreatorFollow> {
  const { data, error } = await supabase
    .from('creator_follows')
    .insert({ follower_profile_id: followerProfileId, creator_profile_id: creatorProfileId })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to follow: ${error.message}`);
  return data as CreatorFollow;
}

// ---------------------------------------------------------------------------
// Delete follow row
// ---------------------------------------------------------------------------

export async function deleteFollow(
  supabase: SupabaseClient,
  followerProfileId: string,
  creatorProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('creator_follows')
    .delete()
    .eq('follower_profile_id', followerProfileId)
    .eq('creator_profile_id', creatorProfileId);

  if (error) throw new Error(`Failed to unfollow: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Get follower count for a creator profile (safe server-side aggregate)
// ---------------------------------------------------------------------------

export async function getFollowerCount(
  supabase: SupabaseClient,
  creatorProfileId: string
): Promise<number> {
  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('user_id')
    .eq('id', creatorProfileId)
    .maybeSingle();

  if (!creator) return 0;

  return getProfileFollowerCount(supabase, creator.user_id);
}

// ---------------------------------------------------------------------------
// Check if current user follows a creator profile
// ---------------------------------------------------------------------------

export async function isFollowing(
  supabase: SupabaseClient,
  followerProfileId: string,
  creatorProfileId: string
): Promise<boolean> {
  const { data: creator } = await supabase
    .from('creator_profiles')
    .select('user_id')
    .eq('id', creatorProfileId)
    .maybeSingle();

  if (!creator) return false;

  const row = await getProfileFollowRow(supabase, followerProfileId, creator.user_id);
  return row !== null;
}

/**
 * Fetches a universal profile follow row.
 */
export async function getProfileFollowRow(
  supabase: SupabaseClient,
  followerProfileId: string,
  followingProfileId: string
): Promise<ProfileFollow | null> {
  const { data, error } = await supabase
    .from('profile_follows')
    .select('*')
    .eq('follower_profile_id', followerProfileId)
    .eq('following_profile_id', followingProfileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check profile follow: ${error.message}`);
  return data as ProfileFollow | null;
}

/**
 * Inserts a universal profile follow row.
 */
export async function insertProfileFollow(
  supabase: SupabaseClient,
  followerProfileId: string,
  followingProfileId: string
): Promise<ProfileFollow> {
  const { data, error } = await supabase
    .from('profile_follows')
    .insert({ follower_profile_id: followerProfileId, following_profile_id: followingProfileId })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to follow profile: ${error.message}`);
  return data as ProfileFollow;
}

/**
 * Deletes a universal profile follow row.
 */
export async function deleteProfileFollow(
  supabase: SupabaseClient,
  followerProfileId: string,
  followingProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('profile_follows')
    .delete()
    .eq('follower_profile_id', followerProfileId)
    .eq('following_profile_id', followingProfileId);

  if (error) throw new Error(`Failed to unfollow profile: ${error.message}`);
}

/**
 * Gets count of users following a profile.
 */
export async function getProfileFollowerCount(
  supabase: SupabaseClient,
  followingProfileId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('profile_follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_profile_id', followingProfileId);

  if (error) throw new Error(`Failed to count profile followers: ${error.message}`);
  return count ?? 0;
}

/**
 * Gets count of profiles a user is following.
 */
export async function getProfileFollowingCount(
  supabase: SupabaseClient,
  followerProfileId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('profile_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_profile_id', followerProfileId);

  if (error) throw new Error(`Failed to count profile following: ${error.message}`);
  return count ?? 0;
}

/**
 * Lists followers for a user profile.
 */
export async function listFollowersForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('profile_follows')
    .select('created_at, profiles!profile_follows_follower_profile_id_fkey(id, full_name, username, avatar_url, role)')
    .eq('following_profile_id', profileId);

  if (error) throw new Error(`Failed to list followers: ${error.message}`);
  return (data ?? []).map((d: any) => ({
    followed_at: d.created_at,
    ...(d.profiles as any)
  }));
}

/**
 * Lists profiles a user is following.
 */
export async function listFollowingForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('profile_follows')
    .select('created_at, profiles!profile_follows_following_profile_id_fkey(id, full_name, username, avatar_url, role)')
    .eq('follower_profile_id', profileId);

  if (error) throw new Error(`Failed to list following: ${error.message}`);
  return (data ?? []).map((d: any) => ({
    followed_at: d.created_at,
    ...(d.profiles as any)
  }));
}

