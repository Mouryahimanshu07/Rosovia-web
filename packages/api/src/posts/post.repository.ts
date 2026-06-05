import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreatorPost,
  CreatorPostWithDetails,
  FeedParams,
} from '@rosovia/core';
import { getDatabaseClients } from '@rosovia/integrations';

const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Public feed: approved, public, non-deleted posts only
// ---------------------------------------------------------------------------

export async function listPublicWorkFeedPosts(
  supabase: SupabaseClient,
  params: FeedParams = {}
): Promise<{ data: CreatorPostWithDetails[]; hasNext: boolean }> {
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
        profiles!inner ( status, deleted_at )
      ),
      creator_post_media (
        id,
        post_id,
        media_asset_id,
        sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency, category_id )
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

  if (params.q) {
    query = query.ilike('caption', `%${params.q}%`);
  }

  if (params.category) {
    let categoryId = params.category;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i.test(params.category);
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
    data: slice.map(mapRowToPost),
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
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_posts')
    .select(`
      *,
      creator_profiles!inner (
        id, display_name, slug, profile_image_url, is_verified, verification_level, user_id, deleted_at
      ),
      creator_post_media (
        id, post_id, media_asset_id, sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency )
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
    const post = mapRowToPost(row);
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
        id, display_name, slug, profile_image_url, is_verified, verification_level, user_id
      ),
      creator_post_media (
        id, post_id, media_asset_id, sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      ),
      listings ( id, title, slug, price, currency )
    `)
    .eq('creator_profile_id', creatorProfileId)
    .in('visibility', allowedVisibilities)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) throw new Error(`Failed to fetch public posts: ${error.message}`);

  return ((data ?? []) as any[]).map(mapRowToPost);
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

function mapRowToPost(row: any): CreatorPostWithDetails {
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    creator_display_name: cp?.display_name ?? null,
    creator_slug: cp?.slug ?? null,
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
  };
}
