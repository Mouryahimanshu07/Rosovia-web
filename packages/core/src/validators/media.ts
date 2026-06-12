// packages/core/src/validators/media.ts

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Allowed MIME types
// ---------------------------------------------------------------------------

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

// ---------------------------------------------------------------------------
// Size limits (bytes)
// ---------------------------------------------------------------------------

export const MAX_SIZE = {
  profile_image: 5 * 1024 * 1024,          // 5 MB
  listing_media_image: 10 * 1024 * 1024,   // 10 MB
  listing_media_video: 50 * 1024 * 1024,   // 50 MB
  verification_document: 10 * 1024 * 1024, // 10 MB
  general: 10 * 1024 * 1024,               // 10 MB
} as const;

// ---------------------------------------------------------------------------
// signedUploadRequestSchema
// ---------------------------------------------------------------------------

export const signedUploadRequestSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().refine(
      (v) => (ALL_ALLOWED_MIME_TYPES as readonly string[]).includes(v),
      { message: 'Unsupported file type.' }
    ),
    sizeBytes: z.number().int().positive(),
    mediaType: z.enum(['image', 'video', 'document']),
    usage: z.enum(['profile_image', 'listing_media', 'verification_document', 'post_media', 'general', 'portfolio', 'message_attachment']),
    listingId: z.string().uuid().optional(),
    conversationId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
    isPrivate: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    // listing_media requires a listingId
    if (data.usage === 'listing_media' && !data.listingId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['listingId'], message: 'listingId is required for listing_media uploads.' });
    }

    // message_attachment requires conversationId and messageId
    if (data.usage === 'message_attachment') {
      if (!data.conversationId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conversationId'], message: 'conversationId is required for message attachments.' });
      }
      if (!data.messageId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['messageId'], message: 'messageId is required for message attachments.' });
      }
      if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Message attachments must be JPEG, PNG, or WebP.' });
      }
      if (data.sizeBytes > 10 * 1024 * 1024) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: 'Message attachments must be 10 MB or smaller.' });
      }
    }

    // verification_document must be private
    if (data.usage === 'verification_document') {
      data.isPrivate = true;
    }

    // profile_image: image only, 5 MB max
    if (data.usage === 'profile_image') {
      if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Profile images must be JPEG, PNG, or WebP.' });
      }
      if (data.sizeBytes > MAX_SIZE.profile_image) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: 'Profile image must be 5 MB or smaller.' });
      }
    }

    // listing_media: respect image vs video limits
    if (data.usage === 'listing_media') {
      if (data.mediaType === 'image') {
        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Listing images must be JPEG, PNG, or WebP.' });
        }
        if (data.sizeBytes > MAX_SIZE.listing_media_image) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: 'Listing images must be 10 MB or smaller.' });
        }
      }
      if (data.mediaType === 'video') {
        if (!(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Listing videos must be MP4 or WebM.' });
        }
        if (data.sizeBytes > MAX_SIZE.listing_media_video) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: 'Listing videos must be 50 MB or smaller.' });
        }
      }
    }

    // verification_document: pdf/image only, 10 MB max
    if (data.usage === 'verification_document') {
      if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'Verification documents must be PDF, JPEG, or PNG.' });
      }
      if (data.sizeBytes > MAX_SIZE.verification_document) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: 'Verification documents must be 10 MB or smaller.' });
      }
    }

    // post_media & portfolio: respect image vs video limits
    if (data.usage === 'post_media' || data.usage === 'portfolio') {
      if (data.mediaType === 'image') {
        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: `${data.usage === 'portfolio' ? 'Portfolio' : 'Post'} images must be JPEG, PNG, or WebP.` });
        }
        if (data.sizeBytes > MAX_SIZE.listing_media_image) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: `${data.usage === 'portfolio' ? 'Portfolio' : 'Post'} images must be 10 MB or smaller.` });
        }
      }
      if (data.mediaType === 'video') {
        if (!(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(data.mimeType)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: `${data.usage === 'portfolio' ? 'Portfolio' : 'Post'} videos must be MP4 or WebM.` });
        }
        if (data.sizeBytes > MAX_SIZE.listing_media_video) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: `${data.usage === 'portfolio' ? 'Portfolio' : 'Post'} videos must be 50 MB or smaller.` });
        }
      }
    }
  });

export type SignedUploadRequestInput = z.infer<typeof signedUploadRequestSchema>;

// ---------------------------------------------------------------------------
// mediaMetadataCreateSchema — used by /api/media/complete
// ---------------------------------------------------------------------------

export const mediaMetadataCreateSchema = z.object({
  listingId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  mediaType: z.enum(['image', 'video', 'document']),
  storageKey: z.string().min(1).max(1024),
  publicUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(255),
  durationSeconds: z.number().int().min(0).optional(),
  isPrivate: z.boolean(),
  usage: z.enum(['profile_image', 'listing_media', 'verification_document', 'post_media', 'general', 'portfolio', 'message_attachment']),
});

export type MediaMetadataCreateInput = z.infer<typeof mediaMetadataCreateSchema>;

// ---------------------------------------------------------------------------
// mediaUpdateSchema
// ---------------------------------------------------------------------------

export const mediaUpdateSchema = z.object({
  status: z
  .enum([
    'uploaded',
    'processing',
    'pending_review',
    'approved',
    'rejected',
    'failed',
    'deleted'
  ])
  .optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

// ---------------------------------------------------------------------------
// mediaPresentationUpdateSchema
// ---------------------------------------------------------------------------

export const mediaPresentationUpdateSchema = z.object({
  alt_text: z.string().max(300).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type MediaPresentationUpdateInput = z.infer<typeof mediaPresentationUpdateSchema>;
