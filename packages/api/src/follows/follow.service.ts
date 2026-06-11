import type { SupabaseClient } from '@supabase/supabase-js';
import {
  followCreatorSchema,
  unfollowCreatorSchema,
  followProfileSchema,
  unfollowProfileSchema,
  type CreatorFollow,
  type ProfileFollow,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createSystemNotification } from '../notifications/notification.service';
import {
  getFollowRow,
  insertFollow,
  deleteFollow,
  isFollowing,
  getFollowerCount,
  getProfileFollowRow,
  insertProfileFollow,
  deleteProfileFollow,
  getProfileFollowerCount,
  getProfileFollowingCount,
  listFollowersForProfile,
  listFollowingForProfile,
} from './follow.repository';

// Re-export safe helpers for SSR
export { isFollowing, getFollowerCount };

// ---------------------------------------------------------------------------
// Internal: resolve active profile
// ---------------------------------------------------------------------------
async function resolveActiveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

export interface FollowResponse {
  success: boolean;
  isFollowing: boolean;
  followerCount?: number;
}

// ---------------------------------------------------------------------------
// Follow a creator profile
// ---------------------------------------------------------------------------

export async function followCreator(
  supabase: SupabaseClient,
  rawInput: { creatorProfileId: string }
): Promise<FollowResponse> {
  const input = followCreatorSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // Verify target creator exists and is active
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at, profiles!inner(status, deleted_at)')
    .eq('id', input.creatorProfileId)
    .is('deleted_at', null)
    .single();

  if (creatorError || !creatorData) {
    throw new Error('Creator not found or unavailable');
  }

  const cp = creatorData as any;

  // Prevent self-follow
  if (cp.user_id === profile.id) {
    throw new Error('You cannot follow yourself');
  }

  // Check for duplicate follow
  const existing = await getFollowRow(supabase, profile.id, input.creatorProfileId);
  if (existing) {
    const followerCount = await getFollowerCount(supabase, input.creatorProfileId);
    return { success: true, isFollowing: true, followerCount };
  }

  // TODO: Rate-limit hook — max X follow actions per minute per user

  try {
    const follow = await insertFollow(supabase, profile.id, input.creatorProfileId);

    // Notify creator
    try {
      await createSystemNotification(supabase, {
        recipientProfileId: cp.user_id,
        type: 'new_follower',
        title: 'New Follower',
        body: 'Someone started following your profile.',
        entityType: 'follow',
        entityId: follow.id,
      });
    } catch (e) {
      console.error('Failed to notify creator of new follower:', e);
    }
  } catch (err: any) {
    if (!err.message?.includes('23505')) {
      throw err;
    }
  }

  const followerCount = await getFollowerCount(supabase, input.creatorProfileId);
  return { success: true, isFollowing: true, followerCount };
}

// ---------------------------------------------------------------------------
// Unfollow a creator profile
// ---------------------------------------------------------------------------

export async function unfollowCreator(
  supabase: SupabaseClient,
  rawInput: { creatorProfileId: string }
): Promise<FollowResponse> {
  const input = unfollowCreatorSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // Check if follow row exists
  const existing = await getFollowRow(supabase, profile.id, input.creatorProfileId);
  if (!existing) {
    const followerCount = await getFollowerCount(supabase, input.creatorProfileId);
    return { success: true, isFollowing: false, followerCount };
  }

  await deleteFollow(supabase, profile.id, input.creatorProfileId);
  const followerCount = await getFollowerCount(supabase, input.creatorProfileId);
  return { success: true, isFollowing: false, followerCount };
}

// ---------------------------------------------------------------------------
// Check if current user is following a creator
// ---------------------------------------------------------------------------

export async function isCurrentUserFollowing(
  supabase: SupabaseClient,
  creatorProfileId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) return false;

  return isFollowing(supabase, profile.id, creatorProfileId);
}

// ---------------------------------------------------------------------------
// Follow a user profile (universal)
// ---------------------------------------------------------------------------

export async function followProfile(
  supabase: SupabaseClient,
  rawInput: { followingProfileId: string }
): Promise<FollowResponse> {
  const input = followProfileSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // Prevent self-follow
  if (input.followingProfileId === profile.id) {
    throw new Error('You cannot follow yourself');
  }

  // Verify target profile exists and is active
  const { data: targetProfile, error: targetError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', input.followingProfileId)
    .is('deleted_at', null)
    .single();

  if (targetError || !targetProfile) {
    throw new Error('Target profile not found or unavailable');
  }

  if (targetProfile.status !== 'active') {
    throw new Error('Target profile is not active');
  }

  // Check for duplicate follow
  const existing = await getProfileFollowRow(supabase, profile.id, input.followingProfileId);
  if (existing) {
    const stats = await getProfileFollowStats(supabase, input.followingProfileId);
    return { success: true, isFollowing: true, followerCount: stats.followersCount };
  }

  try {
    const follow = await insertProfileFollow(supabase, profile.id, input.followingProfileId);

    // Notify target user
    try {
      await createSystemNotification(supabase, {
        recipientProfileId: input.followingProfileId,
        type: 'new_follower',
        title: 'New Follower',
        body: `${profile.full_name || profile.username || 'Someone'} started following your profile.`,
        entityType: 'follow',
        entityId: follow.id,
      });
    } catch (e) {
      console.error('Failed to notify profile of new follower:', e);
    }
  } catch (err: any) {
    if (err.message?.includes('23505')) {
      // Duplicate follow (race condition), ignore error
    } else {
      console.error('Database/RLS error in followProfile:', err);
      // Suppress raw error, return failure status
      try {
        const stats = await getProfileFollowStats(supabase, input.followingProfileId);
        return { success: false, isFollowing: false, followerCount: stats.followersCount };
      } catch (_) {
        return { success: false, isFollowing: false, followerCount: 0 };
      }
    }
  }

  const stats = await getProfileFollowStats(supabase, input.followingProfileId);
  return { success: true, isFollowing: true, followerCount: stats.followersCount };
}

// ---------------------------------------------------------------------------
// Unfollow a user profile (universal)
// ---------------------------------------------------------------------------

export async function unfollowProfile(
  supabase: SupabaseClient,
  rawInput: { followingProfileId: string }
): Promise<FollowResponse> {
  const input = unfollowProfileSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // Check if follow row exists
  const existing = await getProfileFollowRow(supabase, profile.id, input.followingProfileId);
  if (!existing) {
    const stats = await getProfileFollowStats(supabase, input.followingProfileId);
    return { success: true, isFollowing: false, followerCount: stats.followersCount };
  }

  try {
    await deleteProfileFollow(supabase, profile.id, input.followingProfileId);
  } catch (err: any) {
    console.error('Database/RLS error in unfollowProfile:', err);
    try {
      const stats = await getProfileFollowStats(supabase, input.followingProfileId);
      return { success: false, isFollowing: true, followerCount: stats.followersCount };
    } catch (_) {
      return { success: false, isFollowing: true, followerCount: 0 };
    }
  }
  const stats = await getProfileFollowStats(supabase, input.followingProfileId);
  return { success: true, isFollowing: false, followerCount: stats.followersCount };
}

// ---------------------------------------------------------------------------
// Check if current user is following a specific profile
// ---------------------------------------------------------------------------

export async function isCurrentUserFollowingProfile(
  supabase: SupabaseClient,
  followingProfileId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) return false;

  const row = await getProfileFollowRow(supabase, profile.id, followingProfileId);
  return row !== null;
}

// ---------------------------------------------------------------------------
// Get follow/follower counts for a profile
// ---------------------------------------------------------------------------

export async function getProfileFollowStats(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ followersCount: number; followingCount: number }> {
  const [followersCount, followingCount] = await Promise.all([
    getProfileFollowerCount(supabase, profileId),
    getProfileFollowingCount(supabase, profileId),
  ]);
  return { followersCount, followingCount };
}

// ---------------------------------------------------------------------------
// List followers/following for a profile
// ---------------------------------------------------------------------------

export async function listProfileFollowers(
  supabase: SupabaseClient,
  profileId: string
): Promise<any[]> {
  return listFollowersForProfile(supabase, profileId);
}

export async function listProfileFollowing(
  supabase: SupabaseClient,
  profileId: string
): Promise<any[]> {
  return listFollowingForProfile(supabase, profileId);
}

