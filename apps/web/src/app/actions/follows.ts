'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { followCreator, unfollowCreator, followProfile, unfollowProfile } from '@rosovia/api';
import { captureAppError } from '~/lib/analytics/capture-error';
import { headers } from 'next/headers';
import { rateLimit } from '~/lib/rate-limit';

async function checkRateLimit(limit: number) {
  const supabase = createWebServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const identifier = user?.id || headers().get('x-forwarded-for') || '127.0.0.1';
  const limitRes = await rateLimit(identifier, limit, 60000);
  if (!limitRes.success) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
}

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Follow a creator
// ---------------------------------------------------------------------------

export async function followCreatorAction(
  creatorProfileId: string
): Promise<ActionResult> {
  try {
    await checkRateLimit(20);
    const supabase = createWebServerClient();
    await followCreator(supabase, { creatorProfileId });
    revalidatePath('/creators');
    revalidatePath('/explore');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'follows', action: 'follow' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to follow creator',
    };
  }
}

// ---------------------------------------------------------------------------
// Unfollow a creator
// ---------------------------------------------------------------------------

export async function unfollowCreatorAction(
  creatorProfileId: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await unfollowCreator(supabase, { creatorProfileId });
    revalidatePath('/creators');
    revalidatePath('/explore');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'follows', action: 'unfollow' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unfollow creator',
    };
  }
}

// ---------------------------------------------------------------------------
// Follow a user profile (universal)
// ---------------------------------------------------------------------------

export async function followProfileAction(
  followingProfileId: string,
  username: string
): Promise<ActionResult<{ isFollowing: boolean; followerCount: number }>> {
  try {
    await checkRateLimit(20);
    const supabase = createWebServerClient();
    const result = await followProfile(supabase, { followingProfileId });
    revalidatePath(`/u/${username}`);
    revalidatePath(`/u/${username}/followers`);
    revalidatePath(`/u/${username}/following`);
    if (!result.success) {
      return { success: false, error: 'Database or permission error occurred' };
    }
    return {
      success: true,
      data: {
        isFollowing: result.isFollowing,
        followerCount: result.followerCount ?? 0,
      },
    };
  } catch (err) {
    captureAppError(err, { module: 'follows', action: 'followProfile' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to follow user',
    };
  }
}

// ---------------------------------------------------------------------------
// Unfollow a user profile (universal)
// ---------------------------------------------------------------------------

export async function unfollowProfileAction(
  followingProfileId: string,
  username: string
): Promise<ActionResult<{ isFollowing: boolean; followerCount: number }>> {
  try {
    const supabase = createWebServerClient();
    const result = await unfollowProfile(supabase, { followingProfileId });
    revalidatePath(`/u/${username}`);
    revalidatePath(`/u/${username}/followers`);
    revalidatePath(`/u/${username}/following`);
    if (!result.success) {
      return { success: false, error: 'Database or permission error occurred' };
    }
    return {
      success: true,
      data: {
        isFollowing: result.isFollowing,
        followerCount: result.followerCount ?? 0,
      },
    };
  } catch (err) {
    captureAppError(err, { module: 'follows', action: 'unfollowProfile' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unfollow user',
    };
  }
}
