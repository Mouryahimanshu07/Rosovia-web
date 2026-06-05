// packages/core/src/types/post.ts
// Creator Work Post types for Rosovia social-commerce layer.

export type PostType =
  | 'image'
  | 'short_video'
  | 'portfolio'
  | 'listing_showcase'
  | 'carousel';

export type PostVisibility = 'public' | 'followers' | 'private';

export type PostModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface CreatorPost {
  id: string;
  creator_profile_id: string;
  caption: string | null;
  post_type: PostType;
  listing_id: string | null;
  visibility: PostVisibility;
  moderation_status: PostModerationStatus;
  like_count: number;
  save_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreatorPostMedia {
  id: string;
  post_id: string;
  media_asset_id: string;
  sort_order: number;
  created_at: string;
}

export interface CreatorPostMediaWithUrl extends CreatorPostMedia {
  public_url: string | null;
  mime_type: string;
  media_type: 'image' | 'video' | 'document';
  thumbnail_url: string | null;
}

/** Post with creator info and media for feed/profile display */
export interface CreatorPostWithDetails extends CreatorPost {
  creator_display_name: string | null;
  creator_slug: string | null;
  creator_profile_image_url: string | null;
  creator_is_verified: boolean;
  creator_verification_level: string;
  category_name: string | null;
  media: CreatorPostMediaWithUrl[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreatePostInput {
  caption?: string | null;
  postType: PostType;
  listingId?: string | null;
  visibility?: PostVisibility;
  mediaAssetIds: string[];
}

export interface UpdatePostInput {
  caption?: string | null;
  visibility?: PostVisibility;
}

export interface PostListParams {
  page?: number;
  postType?: PostType;
  visibility?: PostVisibility;
}

export interface FeedParams {
  page?: number;
  postType?: PostType;
  category?: string;
  sort?: 'newest' | 'popular';
  q?: string;
}
