'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCreatorPost,
  updateCreatorPost,
  deleteCreatorPost,
  getCurrentProfile,
} from '@rosovia/api';
import type { CreatePostSchemaInput, UpdatePostSchemaInput } from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Create a new creator work post
// ---------------------------------------------------------------------------

export async function createPostAction(
  input: CreatePostSchemaInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createWebServerClient();
    const post = await createCreatorPost(supabase, input);

    revalidatePath('/dashboard/creator/posts');
    revalidatePath('/explore');

    // Also revalidate the creator's public profile posts page
    const profile = await getCurrentProfile(supabase);
    if (profile?.username) {
      revalidatePath(`/u/${profile.username}`);
      revalidatePath(`/u/${profile.username}/posts`);
    }

    return { success: true, data: { id: post.id } };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'create_post' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create post',
    };
  }
}

// ---------------------------------------------------------------------------
// Update own post (caption, visibility)
// ---------------------------------------------------------------------------

export async function updatePostAction(
  postId: string,
  input: UpdatePostSchemaInput
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await updateCreatorPost(supabase, postId, input);

    revalidatePath('/dashboard/creator/posts');
    revalidatePath('/explore');

    const profile = await getCurrentProfile(supabase);
    if (profile?.username) {
      revalidatePath(`/u/${profile.username}`);
      revalidatePath(`/u/${profile.username}/posts`);
    }

    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'update_post' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update post',
    };
  }
}

// ---------------------------------------------------------------------------
// Delete own post
// ---------------------------------------------------------------------------

export async function deletePostAction(postId: string): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await deleteCreatorPost(supabase, postId);

    revalidatePath('/dashboard/creator/posts');
    revalidatePath('/explore');

    const profile = await getCurrentProfile(supabase);
    if (profile?.username) {
      revalidatePath(`/u/${profile.username}`);
      revalidatePath(`/u/${profile.username}/posts`);
    }

    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'delete_post' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete post',
    };
  }
}
