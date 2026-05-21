// packages/core/src/types/media.ts

export type MediaType = 'image' | 'video' | 'document';

export type MediaStatus =
  | 'uploaded'
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'deleted';
export type MediaUsage =
  | 'profile_image'
  | 'listing_media'
  | 'verification_document'
  | 'general';

export interface MediaAsset {
  id: string;
  owner_id: string;
  listing_id: string | null;
  media_type: MediaType;
  storage_provider: 'cloudflare_r2';
  storage_key: string;
  public_url: string | null;
  thumbnail_url: string | null;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number | null;
  is_private: boolean;
  status: MediaStatus;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SignedUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: MediaType;
  usage: MediaUsage;
  listingId?: string;
  isPrivate?: boolean;
}

export interface SignedUploadResponse {
  signedUrl: string;
  storageKey: string;
  publicUrl: string | null;
  expiresIn: number;
}
