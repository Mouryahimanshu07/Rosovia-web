'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCreatorPost,
  updateCreatorPost,
  deleteCreatorPost,
  getCurrentProfile,
  toggleLikePost,
  isPostLikedByUser,
  toggleSavePost,
  isPostSavedByUser,
  getPostComments,
  addCommentToPost,
  removeCommentFromPost,
  listPublicWorkFeedPosts,
} from '@rosovia/api';
import type { CreatePostSchemaInput, UpdatePostSchemaInput, FeedParams } from '@rosovia/core';
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
    const result = await deleteCreatorPost(supabase, postId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

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

// ---------------------------------------------------------------------------
// Likes / Saves / Comments actions
// ---------------------------------------------------------------------------

export async function toggleLikePostAction(
  postId: string
): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const supabase = createWebServerClient();
    const result = await toggleLikePost(supabase, postId);
    revalidatePath('/explore');
    return { success: true, data: result };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'toggle_like' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to like/unlike post',
    };
  }
}

export async function isPostLikedByUserAction(
  postId: string
): Promise<ActionResult<boolean>> {
  try {
    const supabase = createWebServerClient();
    const result = await isPostLikedByUser(supabase, postId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' };
  }
}

export async function toggleSavePostAction(
  postId: string
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const supabase = createWebServerClient();
    const result = await toggleSavePost(supabase, postId);
    revalidatePath('/explore');
    return { success: true, data: result };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'toggle_save' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save/unsave post',
    };
  }
}

export async function isPostSavedByUserAction(
  postId: string
): Promise<ActionResult<boolean>> {
  try {
    const supabase = createWebServerClient();
    const result = await isPostSavedByUser(supabase, postId);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' };
  }
}

export async function addCommentAction(
  postId: string,
  body: string
): Promise<ActionResult<any>> {
  try {
    const supabase = createWebServerClient();
    const comment = await addCommentToPost(supabase, postId, body);
    revalidatePath('/explore');
    return { success: true, data: comment };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'add_comment' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add comment',
    };
  }
}

export async function deleteCommentAction(
  commentId: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await removeCommentFromPost(supabase, commentId);
    revalidatePath('/explore');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'posts', action: 'delete_comment' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete comment',
    };
  }
}

export async function getPostCommentsAction(
  postId: string
): Promise<ActionResult<any[]>> {
  try {
    const supabase = createWebServerClient();
    const comments = await getPostComments(supabase, postId);
    return { success: true, data: comments };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load comments',
    };
  }
}

export async function fetchMoreWorkPostsAction(
  params: FeedParams
): Promise<ActionResult<{ data: any[]; hasNext: boolean }>> {
  try {
    const supabase = createWebServerClient();
    const result = await listPublicWorkFeedPosts(supabase, params);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load more posts',
    };
  }
}
