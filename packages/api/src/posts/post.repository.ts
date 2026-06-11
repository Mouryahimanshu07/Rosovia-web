import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreatorPost,
  CreatorPostWithDetails,
  FeedParams,
} from '@rosovia/core';
import { getDatabaseClients } from '@rosovia/integrations';

const PAGE_SIZE = 12;

async function getViewerProfileId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    return profile?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public feed: approved, public, non-deleted posts only
// ---------------------------------------------------------------------------

export async function listPublicWorkFeedPosts(
  supabase: SupabaseClient,
  params: FeedParams = {}
): Promise<{ data: CreatorPostWithDetails[]; hasNext: boolean }> {
  const viewerProfileId = await getViewerProfileId(supabase);
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_posts')
    .select(`
      *,
      creator_profiles!inner (
        id,
        display_name,
        slug,
        profile_image_url,
        is_verified,
        verification_level,
        user_id,
        deleted_at,
        primary_category_id,
        profiles!inner ( username, status, deleted_at )
      ),
      creator_post_media (
        id,
        post_id,
        media_asset_id,
        sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency, category_id ),
      post_likes ( profile_id ),
      post_saves ( profile_id )
    `)
    .eq('visibility', 'public')
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .is('creator_profiles.deleted_at', null)
    .eq('creator_profiles.profiles.status', 'active')
    .is('creator_profiles.profiles.deleted_at', null);

  if (params.postType) {
    query = query.eq('post_type', params.postType);
  }

  if (params.type === 'video') {
    query = query.eq('post_type', 'short_video');
  } else if (params.type === 'image') {
    query = query.in('post_type', ['image', 'carousel', 'portfolio', 'listing_showcase']);
  }

  if (params.verified === true) {
    query = query.eq('creator_profiles.is_verified', true);
  }

  if (params.q) {
    const term = `%${params.q.trim().replace(/[%_]/g, '\\$&')}%`;
    query = query.or(
      `caption.ilike.${term},creator_profiles.display_name.ilike.${term},listings.title.ilike.${term},creator_profiles.profiles.username.ilike.${term}`
    );
  }

  if (params.category) {
    let categoryId = params.category;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(params.category);
    if (!isUuid) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', params.category)
        .single();
      if (cat) {
        categoryId = cat.id;
      } else {
        return { data: [], hasNext: false };
      }
    }

    query = query.or(
      `listings.category_id.eq.${categoryId},creator_profiles.primary_category_id.eq.${categoryId}`
    );
  }

  if (params.sort === 'popular') {
    query = query
      .order('like_count', { ascending: false })
      .order('save_count', { ascending: false })
      .order('comment_count', { ascending: false })
      .order('view_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + PAGE_SIZE);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch work feed: ${error.message}`);

  const rows = (data ?? []) as any[];
  const hasNext = rows.length > PAGE_SIZE;
  const slice = rows.slice(0, PAGE_SIZE);

  return {
    data: slice.map((row) => mapRowToPost(row, viewerProfileId)),
    hasNext,
  };
}

// ---------------------------------------------------------------------------
// Creator's own posts (for dashboard — includes all statuses/visibility)
// ---------------------------------------------------------------------------

export async function listPostsForCreatorProfile(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: { page?: number; visibility?: string; postType?: string } = {}
): Promise<{ data: CreatorPostWithDetails[]; hasNext: boolean }> {
  const viewerProfileId = await getViewerProfileId(supabase);
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_posts')
    .select(`
      *,
      creator_profiles!inner (
        id, display_name, slug, profile_image_url, is_verified, verification_level, user_id, deleted_at,
        profiles!inner ( username, status, deleted_at )
      ),
      creator_post_media (
        id, post_id, media_asset_id, sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency ),
      post_likes ( profile_id ),
      post_saves ( profile_id )
    `)
    .eq('creator_profile_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  if (params.visibility) {
    query = query.eq('visibility', params.visibility);
  }
  if (params.postType) {
    query = query.eq('post_type', params.postType);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch creator posts: ${error.message}`);

  const rows = (data ?? []) as any[];
  const slice = rows.slice(0, PAGE_SIZE);

  // Fetch latest moderation notes for rejected/hidden posts via service role client
  const postIds = slice.map((r) => r.id);
  const latestNoteByPostId: Record<string, string | null> = {};

  if (postIds.length > 0) {
    try {
      const { master: serviceRoleClient } = getDatabaseClients();
      const { data: notes, error: notesError } = await serviceRoleClient
        .from('admin_actions')
        .select('target_id, note, created_at')
        .eq('target_type', 'post')
        .in('target_id', postIds)
        .in('action_type', ['post_rejected', 'post_hidden'])
        .order('created_at', { ascending: false });

      if (!notesError && notes) {
        for (const n of notes) {
          if (!latestNoteByPostId[n.target_id]) {
            latestNoteByPostId[n.target_id] = n.note;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch admin moderation notes for creator posts:', e);
    }
  }

  const mappedPosts = slice.map((row) => {
    const post = mapRowToPost(row, viewerProfileId);
    post.moderation_note = latestNoteByPostId[row.id] ?? null;
    return post;
  });

  const hasNext = rows.length > PAGE_SIZE;
  return {
    data: mappedPosts,
    hasNext,
  };
}

// ---------------------------------------------------------------------------
// Public profile posts (approved + public only)
// ---------------------------------------------------------------------------

export async function listPublicPostsForCreatorProfile(
  supabase: SupabaseClient,
  creatorProfileId: string,
  viewerContext?: { isFollowing?: boolean; isSelf?: boolean }
): Promise<CreatorPostWithDetails[]> {
  const viewerProfileId = await getViewerProfileId(supabase);
  const allowedVisibilities = ['public'];
  if (viewerContext?.isSelf || viewerContext?.isFollowing) {
    allowedVisibilities.push('followers');
  }
  if (viewerContext?.isSelf) {
    allowedVisibilities.push('private');
  }

  const { data, error } = await supabase
    .from('creator_posts')
    .select(`
      *,
      creator_profiles!inner (
        id, display_name, slug, profile_image_url, is_verified, verification_level, user_id,
        profiles!inner ( username, status, deleted_at )
      ),
      creator_post_media (
        id, post_id, media_asset_id, sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency ),
      post_likes ( profile_id ),
      post_saves ( profile_id )
    `)
    .eq('creator_profile_id', creatorProfileId)
    .in('visibility', allowedVisibilities)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) throw new Error(`Failed to fetch public posts: ${error.message}`);

  return ((data ?? []) as any[]).map((row) => mapRowToPost(row, viewerProfileId));
}

// ---------------------------------------------------------------------------
// Single post by ID
// ---------------------------------------------------------------------------

export async function getPostById(
  supabase: SupabaseClient,
  postId: string
): Promise<CreatorPost | null> {
  const { data, error } = await supabase
    .from('creator_posts')
    .select('*')
    .eq('id', postId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch post: ${error.message}`);
  }
  return data as CreatorPost;
}

export async function createPost(
  supabase: SupabaseClient,
  data: {
    creator_profile_id: string;
    caption: string | null;
    post_type: string;
    listing_id: string | null;
    visibility: string;
    moderation_status: string;
  }
): Promise<CreatorPost> {
  const { data: created, error } = await supabase
    .from('creator_posts')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create post: ${error.message}`);
  return created as CreatorPost;
}

export async function attachPostMedia(
  supabase: SupabaseClient,
  postId: string,
  mediaAssetIds: string[]
): Promise<void> {
  const rows = mediaAssetIds.map((id, index) => ({
    post_id: postId,
    media_asset_id: id,
    sort_order: index,
  }));

  const { error } = await supabase.from('creator_post_media').insert(rows);
  if (error) throw new Error(`Failed to attach post media: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Update post (safe fields only)
// ---------------------------------------------------------------------------

export async function updatePost(
  supabase: SupabaseClient,
  postId: string,
  data: { caption?: string | null; visibility?: string }
): Promise<CreatorPost> {
  const { data: updated, error } = await supabase
    .from('creator_posts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update post: ${error.message}`);
  return updated as CreatorPost;
}

// ---------------------------------------------------------------------------
// Soft-delete post
// ---------------------------------------------------------------------------

export async function softDeletePost(
  supabase: SupabaseClient,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('creator_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) throw new Error(`Failed to delete post: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Admin: update moderation_status
// ---------------------------------------------------------------------------

export async function adminUpdatePostModeration(
  supabase: SupabaseClient,
  postId: string,
  moderationStatus: string
): Promise<CreatorPost> {
  const { data: updated, error } = await supabase
    .from('creator_posts')
    .update({ moderation_status: moderationStatus, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update post moderation: ${error.message}`);
  return updated as CreatorPost;
}

// ---------------------------------------------------------------------------
// Internal mapper
// ---------------------------------------------------------------------------

function mapRowToPost(row: any, viewerProfileId?: string | null): CreatorPostWithDetails {
  const cp = row.creator_profiles;
  const media = (row.creator_post_media ?? []).map((m: any) => ({
    id: m.id,
    post_id: m.post_id,
    media_asset_id: m.media_asset_id,
    sort_order: m.sort_order,
    created_at: m.created_at,
    public_url: m.media_assets?.public_url ?? null,
    mime_type: m.media_assets?.mime_type ?? '',
    media_type: m.media_assets?.media_type ?? 'image',
    thumbnail_url: m.media_assets?.thumbnail_url ?? null,
  }));

  // Sort media by sort_order
  media.sort((a: any, b: any) => a.sort_order - b.sort_order);

  const likedByViewer = viewerProfileId
    ? (row.post_likes ?? []).some((l: any) => l.profile_id === viewerProfileId)
    : false;

  const savedByViewer = viewerProfileId
    ? (row.post_saves ?? []).some((s: any) => s.profile_id === viewerProfileId)
    : false;

  return {
    id: row.id,
    creator_profile_id: row.creator_profile_id,
    caption: row.caption,
    post_type: row.post_type,
    listing_id: row.listing_id,
    visibility: row.visibility,
    moderation_status: row.moderation_status,
    like_count: row.like_count,
    save_count: row.save_count,
    view_count: row.view_count,
    comment_count: row.comment_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    creator_user_id: cp?.user_id ?? null,
    creator_display_name: cp?.display_name ?? null,
    creator_slug: cp?.slug ?? null,
    creator_profile_username: cp?.profiles?.username ?? null,
    creator_profile_image_url: cp?.profile_image_url ?? null,
    creator_is_verified: cp?.is_verified ?? false,
    creator_verification_level: cp?.verification_level ?? 'none',
    category_name: null,
    media,
    listing: row.listings
      ? {
          id: row.listings.id,
          title: row.listings.title,
          slug: row.listings.slug,
          price: row.listings.price,
          currency: row.listings.currency,
        }
      : null,
    likedByViewer,
    savedByViewer,
  };
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

export async function isPostLiked(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('post_likes')
    .select('id')
    .eq('profile_id', profileId)
    .eq('post_id', postId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check if post is liked: ${error.message}`);
  return !!data;
}

export async function likePost(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('post_likes')
    .insert({ profile_id: profileId, post_id: postId });

  if (error) {
    if (error.code === '23505') return; // Duplicate like is safe no-op
    throw new Error(`Failed to like post: ${error.message}`);
  }
}

export async function unlikePost(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('profile_id', profileId)
    .eq('post_id', postId);

  if (error) throw new Error(`Failed to unlike post: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

export async function isPostSaved(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('post_saves')
    .select('id')
    .eq('profile_id', profileId)
    .eq('post_id', postId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check if post is saved: ${error.message}`);
  return !!data;
}

export async function savePost(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('post_saves')
    .insert({ profile_id: profileId, post_id: postId });

  if (error) {
    if (error.code === '23505') return; // Duplicate save is safe no-op
    throw new Error(`Failed to save post: ${error.message}`);
  }
}

export async function unsavePost(
  supabase: SupabaseClient,
  profileId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('post_saves')
    .delete()
    .eq('profile_id', profileId)
    .eq('post_id', postId);

  if (error) throw new Error(`Failed to unsave post: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface PostCommentWithProfile {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function listPostComments(
  supabase: SupabaseClient,
  postId: string
): Promise<PostCommentWithProfile[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`
      id,
      post_id,
      profile_id,
      body,
      created_at,
      profiles!inner (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('post_id', postId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list post comments: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    post_id: row.post_id,
    profile_id: row.profile_id,
    body: row.body,
    created_at: row.created_at,
    username: row.profiles?.username ?? null,
    display_name: row.profiles?.full_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

export async function addPostComment(
  supabase: SupabaseClient,
  profileId: string,
  postId: string,
  body: string
): Promise<PostCommentWithProfile> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ profile_id: profileId, post_id: postId, body })
    .select(`
      id,
      post_id,
      profile_id,
      body,
      created_at,
      profiles!inner (
        username,
        full_name,
        avatar_url
      )
    `)
    .single();

  if (error) throw new Error(`Failed to add post comment: ${error.message}`);

  const row = data as any;
  return {
    id: row.id,
    post_id: row.post_id,
    profile_id: row.profile_id,
    body: row.body,
    created_at: row.created_at,
    username: row.profiles?.username ?? null,
    display_name: row.profiles?.full_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
  };
}

export async function deletePostComment(
  supabase: SupabaseClient,
  commentId: string
): Promise<void> {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw new Error(`Failed to delete post comment: ${error.message}`);
}
