import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPostSchema,
  updatePostSchema,
  postListParamsSchema,
  feedParamsSchema,
  type CreatePostSchemaInput,
  type UpdatePostSchemaInput,
  type CreatorPost,
  type CreatorPostWithDetails,
  type FeedParams,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../notifications/notification.service';
import {
  createPost,
  attachPostMedia,
  updatePost,
  softDeletePost,
  getPostById,
  listPostsForCreatorProfile,
  listPublicPostsForCreatorProfile,
  listPublicWorkFeedPosts,
} from './post.repository';

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

// ---------------------------------------------------------------------------
// Internal: resolve active creator profile
// ---------------------------------------------------------------------------
async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) {
    throw new Error('Creator profile not found. Please complete your profile first.');
  }

  return { profile, creatorProfile };
}

// ---------------------------------------------------------------------------
// Public: get work feed (no auth required)
// ---------------------------------------------------------------------------

export async function getPublicWorkFeed(
  supabase: SupabaseClient,
  rawParams: Record<string, string | string[] | undefined> = {}
): Promise<{ data: CreatorPostWithDetails[]; hasNext: boolean }> {
  const parsed = feedParamsSchema.safeParse(rawParams);
  const params: FeedParams = parsed.success ? parsed.data : { page: 1, sort: 'newest' };

  return listPublicWorkFeedPosts(supabase, params);
}

// ---------------------------------------------------------------------------
// Public: get creator public posts (no auth required)
// ---------------------------------------------------------------------------

export { listPublicPostsForCreatorProfile };

// ---------------------------------------------------------------------------
// Creator: create a new work post
// ---------------------------------------------------------------------------

export async function createCreatorPost(
  supabase: SupabaseClient,
  rawInput: CreatePostSchemaInput
): Promise<CreatorPost> {
  const input = createPostSchema.parse(rawInput);

  const { profile, creatorProfile } = await resolveActiveCreatorProfile(supabase);

  // Validate media assets: must belong to this creator's profile user
  const { data: mediaRows, error: mediaError } = await supabase
    .from('media_assets')
    .select('id, owner_id, status, mime_type, is_private')
    .in('id', input.mediaAssetIds);

  if (mediaError) throw new Error('Failed to verify media assets');

  const foundIds = new Set((mediaRows ?? []).map((m: any) => m.id));
  for (const id of input.mediaAssetIds) {
    if (!foundIds.has(id)) throw new Error(`Media asset ${id} not found`);
  }

  for (const m of mediaRows ?? []) {
    const row = m as any;
    if (row.owner_id !== profile.id) {
      throw new Error('One or more media assets do not belong to you');
    }
    if (row.is_private) {
      throw new Error('Private media cannot be used in public posts');
    }
    // Only allow image/video MIME types
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm',
    ];
    if (!allowedMimes.includes(row.mime_type)) {
      throw new Error(`Unsupported media type: ${row.mime_type}`);
    }
  }

  if (input.postType === 'listing_showcase' && !input.listingId) {
    throw new Error('Listing selection is required for a listing showcase post');
  }

  // Validate listing if provided: must belong to this creator
  if (input.listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, creator_id, status')
      .eq('id', input.listingId)
      .is('deleted_at', null)
      .single();

    if (listingError || !listing) throw new Error('Listing not found');
    const l = listing as any;
    if (l.creator_id !== creatorProfile.id) {
      throw new Error('Listing does not belong to your creator profile');
    }
    if (l.status !== 'approved') {
      throw new Error('Only approved listings can be showcased in posts');
    }
  }

  // Create post — instant publish (approved by default, no admin queue).
  // Admins can still hide/reject posts reactively if needed.
  // TODO: Rate limit hook — max X posts per hour per creator
  const post = await createPost(supabase, {
    creator_profile_id: creatorProfile.id,
    caption: input.caption ?? null,
    post_type: input.postType,
    listing_id: input.listingId ?? null,
    visibility: input.visibility ?? 'public',
    moderation_status: 'approved',
  });

  // Attach media
  await attachPostMedia(supabase, post.id, input.mediaAssetIds);

  return post;
}

// ---------------------------------------------------------------------------
// Creator: update own post (safe fields only)
// ---------------------------------------------------------------------------

export async function updateCreatorPost(
  supabase: SupabaseClient,
  postId: string,
  rawInput: UpdatePostSchemaInput
): Promise<CreatorPost> {
  const input = updatePostSchema.parse(rawInput);
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const post = await getPostById(supabase, postId);
  if (!post) throw new Error('Post not found');
  if (post.creator_profile_id !== creatorProfile.id) {
    throw new Error('You do not own this post');
  }

  return updatePost(supabase, postId, {
    caption: input.caption,
    visibility: input.visibility,
  });
}

// ---------------------------------------------------------------------------
// Creator: soft-delete own post
// ---------------------------------------------------------------------------

export async function deleteCreatorPost(
  supabase: SupabaseClient,
  postId: string
): Promise<void> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const post = await getPostById(supabase, postId);
  if (!post) throw new Error('Post not found');
  if (post.creator_profile_id !== creatorProfile.id) {
    throw new Error('You do not own this post');
  }

  await softDeletePost(supabase, postId);
}

// ---------------------------------------------------------------------------
// Creator dashboard: list own posts
// ---------------------------------------------------------------------------

export async function listCreatorOwnPosts(
  supabase: SupabaseClient,
  rawParams: Record<string, string | undefined> = {}
): Promise<{ data: CreatorPostWithDetails[]; hasNext: boolean }> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);
  const parsed = postListParamsSchema.safeParse(rawParams);
  const params = parsed.success ? parsed.data : { page: 1 };

  return listPostsForCreatorProfile(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Admin: moderate post (approve/reject/hide)
// ---------------------------------------------------------------------------

export async function adminModeratePost(
  supabase: SupabaseClient,
  postId: string,
  moderationStatus: 'approved' | 'rejected' | 'hidden'
): Promise<CreatorPost> {
  // Admin check done via RLS — service role client bypasses
  const post = await getPostById(supabase, postId);
  if (!post) throw new Error('Post not found');

  const { data: updated, error } = await supabase
    .from('creator_posts')
    .update({ moderation_status: moderationStatus, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to moderate post: ${error.message}`);

  // Notify creator
  try {
    const { data: cp } = await supabase
      .from('creator_profiles')
      .select('user_id')
      .eq('id', post.creator_profile_id)
      .single();

    if (cp?.user_id) {
      const type = moderationStatus === 'approved' ? 'post_approved' : 'post_rejected';
      await createSystemNotification(supabase, {
        recipientProfileId: cp.user_id,
        type,
        title: moderationStatus === 'approved' ? 'Your post is live!' : 'Post not approved',
        body: moderationStatus === 'approved'
          ? 'Your work post is now visible to the public.'
          : 'Your work post was not approved. Please review our content guidelines.',
        entityType: 'post',
        entityId: post.id,
      });
    }
  } catch (e) {
    console.error('Failed to notify creator of post moderation:', e);
  }

  return updated as CreatorPost;
}
