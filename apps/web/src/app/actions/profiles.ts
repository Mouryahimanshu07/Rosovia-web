'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  updateProfileByAuthUserId,
  getCurrentCreatorProfile,
  updateCurrentUserCreatorProfile,
  createCurrentUserCreatorProfile,
} from '@rosovia/api';
import { profileFormSchema, parseCommaSeparated, type ProfileFormInput } from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function updateProfileAction(
  rawInput: ProfileFormInput
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    
    // 1. Get current authenticated user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 2. Validate input schema
    const input = profileFormSchema.parse(rawInput);

    // 3. Update base profile
    await updateProfileByAuthUserId(supabase, user.id, {
      full_name: input.fullName,
      username: input.username,
      avatar_url: input.avatarUrl ?? null,
      cover_image_url: input.coverImageUrl ?? null,
      bio: input.bio ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? 'India',
      language: input.languages ? parseCommaSeparated(input.languages)[0] ?? null : null,
    });

    // 4. Synchronize with Creator Profile if creator
    const baseProfile = await getCurrentProfile(supabase);
    if (baseProfile?.role === 'creator') {
      const creatorProfile = await getCurrentCreatorProfile(supabase);
      
      const creatorInput = {
        displayName: input.fullName,
        bio: input.bio ?? undefined,
        story: (input as any).story ?? undefined,
        headline: input.headline ?? undefined,
        websiteUrl: input.websiteUrl ?? undefined,
        primaryCategoryId: input.primaryCategoryId ?? undefined,
        skills: input.skills ? parseCommaSeparated(input.skills) : [],
        languages: input.languages ? parseCommaSeparated(input.languages) : [],
        city: input.city ?? undefined,
        state: input.state ?? undefined,
        country: input.country ?? 'India',
        profileImageUrl: input.avatarUrl ?? undefined,
        coverImageUrl: input.coverImageUrl ?? undefined,
        introVideoUrl: (input as any).introVideoUrl ?? undefined,
      };

      if (creatorProfile) {
        await updateCurrentUserCreatorProfile(supabase, creatorProfile.id, creatorInput);
      } else {
        await createCurrentUserCreatorProfile(supabase, creatorInput);
      }
    }

    revalidatePath('/dashboard/profile');
    if (input.username) {
      revalidatePath(`/u/${input.username}`);
      revalidatePath(`/u/${input.username}/edit`);
    }
    
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'profiles', action: 'updateProfileAction' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile',
    };
  }
}
