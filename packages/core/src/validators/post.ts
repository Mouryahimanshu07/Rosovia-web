// packages/core/src/validators/post.ts
// Zod validators for creator work posts.

import { z } from 'zod';

export const POST_TYPES = [
  'image',
  'short_video',
  'portfolio',
  'listing_showcase',
  'carousel',
] as const;

export const POST_VISIBILITIES = ['public', 'followers', 'private'] as const;
export const POST_MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;

// Max number of media assets per post (carousel/portfolio)
export const MAX_POST_MEDIA_ASSETS = 10;

// ---------------------------------------------------------------------------
// 1. createPostSchema
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new creator work post.
 * creator_profile_id, moderation_status, like_count, view_count are resolved server-side.
 * Clients cannot set moderation_status.
 */
export const createPostSchema = z.object({
  caption: z
    .string()
    .max(2200, 'Caption must be 2200 characters or fewer')
    .optional()
    .nullable(),

  postType: z.enum(POST_TYPES, {
    message: 'Invalid post type',
  }),

  listingId: z
    .string()
    .uuid('Listing ID must be a valid UUID')
    .optional()
    .nullable(),

  visibility: z.enum(POST_VISIBILITIES).default('public'),

  /** IDs of existing media_assets to attach. Must be owned by caller. */
  mediaAssetIds: z
    .array(z.string().uuid('Each media asset ID must be a valid UUID'))
    .min(1, 'At least one media asset is required')
    .max(MAX_POST_MEDIA_ASSETS, `Maximum ${MAX_POST_MEDIA_ASSETS} media assets per post`),
});

// ---------------------------------------------------------------------------
// 2. updatePostSchema
// ---------------------------------------------------------------------------

/**
 * Schema for updating own post. Only safe fields (caption, visibility).
 * moderation_status is intentionally excluded — admin only.
 */
export const updatePostSchema = z.object({
  caption: z
    .string()
    .max(2200, 'Caption must be 2200 characters or fewer')
    .optional()
    .nullable(),

  visibility: z.enum(POST_VISIBILITIES).optional(),
});

// ---------------------------------------------------------------------------
// 3. postListParamsSchema
// ---------------------------------------------------------------------------

export const postListParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  postType: z.enum(POST_TYPES).optional(),
  visibility: z.enum(POST_VISIBILITIES).optional(),
});

// ---------------------------------------------------------------------------
// 4. feedParamsSchema
// ---------------------------------------------------------------------------

export const feedParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().catch(1).default(1),
  postType: z.enum(POST_TYPES).optional().catch(undefined),
  category: z.string().max(100).optional(),
  sort: z.enum(['newest', 'latest', 'popular']).optional().default('newest'),
  q: z.string().max(100).optional(),
  type: z.enum(['all', 'image', 'video']).optional(),
  verified: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

// ---------------------------------------------------------------------------
// 5. adminPostModerationSchema
// ---------------------------------------------------------------------------

export const adminPostModerationSchema = z.object({
  postId: z.string().uuid('Post ID must be a valid UUID'),
  moderationStatus: z.enum(['approved', 'rejected', 'hidden'], {
    message: 'Invalid moderation action',
  }),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreatePostSchemaInput = z.infer<typeof createPostSchema>;
export type UpdatePostSchemaInput = z.infer<typeof updatePostSchema>;
export type PostListParamsSchemaInput = z.infer<typeof postListParamsSchema>;
export type FeedParamsSchemaInput = z.infer<typeof feedParamsSchema>;
export type AdminPostModerationSchemaInput = z.infer<typeof adminPostModerationSchema>;
