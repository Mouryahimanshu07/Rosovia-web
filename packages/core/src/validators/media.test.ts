import { describe, expect, it } from 'vitest';
import {
  MAX_SIZE,
  mediaMetadataCreateSchema,
  mediaUpdateSchema,
  signedUploadRequestSchema,
} from './media';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('media validators', () => {
  describe('signedUploadRequestSchema', () => {
    it('accepts valid profile image upload request', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'profile.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        mediaType: 'image',
        usage: 'profile_image',
      });

      expect(result.success).toBe(true);
    });

    it('rejects profile image if MIME type is video', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'profile.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
        mediaType: 'video',
        usage: 'profile_image',
      });

      expect(result.success).toBe(false);
    });

    it('rejects profile image larger than 5 MB', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'large-profile.png',
        mimeType: 'image/png',
        sizeBytes: MAX_SIZE.profile_image + 1,
        mediaType: 'image',
        usage: 'profile_image',
      });

      expect(result.success).toBe(false);
    });

    it('requires listingId for listing_media uploads', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'listing.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        mediaType: 'image',
        usage: 'listing_media',
      });

      expect(result.success).toBe(false);
    });

    it('accepts listing image with valid listingId', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'listing.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        mediaType: 'image',
        usage: 'listing_media',
        listingId: uuid,
      });

      expect(result.success).toBe(true);
    });

    it('accepts listing video within size limit', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'demo.mp4',
        mimeType: 'video/mp4',
        sizeBytes: MAX_SIZE.listing_media_video,
        mediaType: 'video',
        usage: 'listing_media',
        listingId: uuid,
      });

      expect(result.success).toBe(true);
    });

    it('rejects listing video above size limit', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'large-demo.mp4',
        mimeType: 'video/mp4',
        sizeBytes: MAX_SIZE.listing_media_video + 1,
        mediaType: 'video',
        usage: 'listing_media',
        listingId: uuid,
      });

      expect(result.success).toBe(false);
    });

    it('forces verification documents to private', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'identity.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        mediaType: 'document',
        usage: 'verification_document',
        isPrivate: false,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.isPrivate).toBe(true);
      }
    });

    it('accepts valid post image upload request', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'work.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        mediaType: 'image',
        usage: 'post_media',
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid post video upload request', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 10 * 1024 * 1024,
        mediaType: 'video',
        usage: 'post_media',
      });

      expect(result.success).toBe(true);
    });

    it('rejects post video larger than limit', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'huge.mp4',
        mimeType: 'video/mp4',
        sizeBytes: MAX_SIZE.listing_media_video + 1,
        mediaType: 'video',
        usage: 'post_media',
      });

      expect(result.success).toBe(false);
    });

    it('rejects unsupported MIME type', () => {
      const result = signedUploadRequestSchema.safeParse({
        fileName: 'script.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
        mediaType: 'document',
        usage: 'general',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('mediaMetadataCreateSchema', () => {
    it('accepts valid uploaded media metadata', () => {
      const result = mediaMetadataCreateSchema.safeParse({
        listingId: uuid,
        mediaType: 'image',
        storageKey: 'public/listings/image.png',
        publicUrl: 'https://example.com/image.png',
        sizeBytes: 1024,
        mimeType: 'image/png',
        isPrivate: false,
        usage: 'listing_media',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid public URL', () => {
      const result = mediaMetadataCreateSchema.safeParse({
        mediaType: 'image',
        storageKey: 'public/listings/image.png',
        publicUrl: 'not-a-url',
        sizeBytes: 1024,
        mimeType: 'image/png',
        isPrivate: false,
        usage: 'general',
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty storage key', () => {
      const result = mediaMetadataCreateSchema.safeParse({
        mediaType: 'image',
        storageKey: '',
        sizeBytes: 1024,
        mimeType: 'image/png',
        isPrivate: false,
        usage: 'general',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('mediaUpdateSchema', () => {
    it('accepts approved media status after media moderation hardening', () => {
      const result = mediaUpdateSchema.safeParse({
        status: 'approved',
      });

      expect(result.success).toBe(true);
    });

    it('accepts rejected media status after media moderation hardening', () => {
      const result = mediaUpdateSchema.safeParse({
        status: 'rejected',
      });

      expect(result.success).toBe(true);
    });

    it('rejects unknown media status', () => {
      const result = mediaUpdateSchema.safeParse({
        status: 'ready_for_public',
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative duration', () => {
      const result = mediaUpdateSchema.safeParse({
        durationSeconds: -1,
      });

      expect(result.success).toBe(false);
    });
  });
});