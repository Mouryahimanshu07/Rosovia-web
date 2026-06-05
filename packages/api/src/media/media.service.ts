import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaAsset, SignedUploadRequest, SignedUploadResponse, MediaMetadataCreateInput, MediaPresentationUpdateInput } from '@rosovia/core';
import { signedUploadRequestSchema, mediaPresentationUpdateSchema } from '@rosovia/core';
import { generateStorageKey, createSignedUploadUrl, getR2ObjectMetadata } from '@rosovia/integrations';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { getListingById } from '../listings/listing.repository';
import {
  createMediaAsset,
  softDeleteMediaAsset,
  getMediaAssetById,
  listMediaByOwnerId,
  updateMediaPresentationMetadataRecord,
  type CreateMediaAssetData,
} from './media.repository';

export {
  getMediaAssetById,
  listMediaByOwnerId,
  listCreatorPublicPortfolioMedia,
  listMediaByListingId,
  updateMediaAsset,
} from './media.repository';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  return profile;
}

// ---------------------------------------------------------------------------
// createSignedMediaUpload
// Validates the request, generates storage key, returns signed URL.
// ---------------------------------------------------------------------------

export async function createSignedMediaUpload(
  supabase: SupabaseClient,
  rawInput: SignedUploadRequest
): Promise<SignedUploadResponse> {
  const parsed = signedUploadRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid upload request');
  }
  const input = parsed.data;

  const profile = await resolveProfile(supabase);
  const isPrivate = input.isPrivate ?? input.usage === 'verification_document';

  // Determine storage key context
  let storageKey: string;
  if (isPrivate) {
    storageKey = generateStorageKey({ scope: 'private', profileId: profile.id }, input.fileName);
  } else if (input.usage === 'listing_media' && input.listingId) {
    // Verify listing belongs to current creator before allowing key generation
    const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
    if (!creatorProfile) throw new Error('Creator profile required for listing media uploads.');
    const listing = await getListingById(supabase, input.listingId);
    if (!listing) throw new Error('Listing not found.');
    if (listing.creator_id !== creatorProfile.id) throw new Error('You do not own this listing.');
    storageKey = generateStorageKey({ scope: 'listing', listingId: input.listingId }, input.fileName);
  } else if (input.usage === 'post_media') {
    storageKey = generateStorageKey({ scope: 'profile', profileId: `${profile.id}/posts` }, input.fileName);
  } else {
    storageKey = generateStorageKey({ scope: 'profile', profileId: profile.id }, input.fileName);
  }

  const result = await createSignedUploadUrl({
    storageKey,
    contentType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  // Private media must never have a publicUrl
  const publicUrl = isPrivate ? null : result.publicUrl;

  return {
    signedUrl: result.signedUrl,
    storageKey: result.storageKey,
    publicUrl,
    expiresIn: result.expiresIn,
  };
}

// ---------------------------------------------------------------------------
// saveUploadedMediaMetadata
// Called after the browser PUT to R2 completes.
// The server derives sensitive fields — never trusts client.
// ---------------------------------------------------------------------------

export async function saveUploadedMediaMetadata(
  supabase: SupabaseClient,
  input: MediaMetadataCreateInput
): Promise<MediaAsset> {
  const profile = await resolveProfile(supabase);

  // Security: verify the storageKey's path prefix belongs to the current user's profile
  const allowedPrefixes = [
    `public/profiles/${profile.id}/`,
    `private/users/${profile.id}/`,
  ];

  // For listing_media, also allow listing-scoped paths
  if (input.usage === 'listing_media' && input.listingId) {
    allowedPrefixes.push(`public/listings/${input.listingId}/`);
  }

  const keyIsAllowed = allowedPrefixes.some((prefix) => input.storageKey.startsWith(prefix));
  if (!keyIsAllowed) {
    throw new Error('Storage key does not belong to your allowed upload context.');
  }

  // For listing_media: verify listing ownership
  if (input.usage === 'listing_media' && input.listingId) {
    const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
    if (!creatorProfile) throw new Error('Creator profile required for listing media.');
    const listing = await getListingById(supabase, input.listingId);
    if (!listing) throw new Error('Listing not found.');
    if (listing.creator_id !== creatorProfile.id) throw new Error('You do not own this listing.');
  }

  // Verify the uploaded object exists in R2 before creating the DB row.
  // This prevents fake metadata rows for files that were never uploaded.
  const objectMetadata = await getR2ObjectMetadata(input.storageKey);
  if (!objectMetadata.exists) {
    throw new Error('Uploaded object was not found in storage. Please retry the upload.');
  }

  if (objectMetadata.contentLength !== null && objectMetadata.contentLength !== input.sizeBytes) {
    throw new Error('Uploaded file size does not match the signed upload request.');
  }

  if (objectMetadata.contentType && objectMetadata.contentType !== input.mimeType) {
    throw new Error('Uploaded file MIME type does not match the signed upload request.');
  }

  // Server always derives is_private from storageKey prefix — don't trust client
  const isPrivate = input.storageKey.startsWith('private/');

  // Server derives publicUrl from env var — never trust client-supplied URL
  let publicUrl: string | null = null;
  if (!isPrivate) {
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (base) {
      publicUrl = `${base.replace(/\/$/, '')}/${input.storageKey}`;
    }
  }

  const row: CreateMediaAssetData = {
    owner_id: profile.id,
    listing_id: input.listingId ?? null,
    media_type: input.mediaType,
    storage_provider: 'cloudflare_r2',
    storage_key: input.storageKey,
    public_url: publicUrl,
    thumbnail_url: null, // thumbnail generation is future work
    size_bytes: input.sizeBytes,
    mime_type: input.mimeType,
    duration_seconds: input.durationSeconds ?? null,
    is_private: isPrivate,
    status: isPrivate ? 'uploaded' : 'processing',
  };

  return createMediaAsset(supabase, row);
}

// ---------------------------------------------------------------------------
// attachMediaToCreatorProfile
// Updates creator_profiles.profile_image_url with the media public URL.
// ---------------------------------------------------------------------------

export async function attachMediaToCreatorProfile(
  supabase: SupabaseClient,
  mediaId: string
): Promise<void> {
  const profile = await resolveProfile(supabase);
  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) throw new Error('Creator profile not found.');

  const media = await getMediaAssetById(supabase, mediaId);
  if (!media) throw new Error('Media asset not found.');
  if (media.owner_id !== profile.id) throw new Error('You do not own this media asset.');
  if (media.is_private) throw new Error('Cannot use a private media asset as a profile image.');
  if (!media.public_url) throw new Error('Media asset has no public URL.');

  const { error } = await supabase
    .from('creator_profiles')
    .update({ profile_image_url: media.public_url })
    .eq('id', creatorProfile.id);

  if (error) throw new Error(`Failed to update profile image: ${error.message}`);
}

// ---------------------------------------------------------------------------
// attachMediaToListing — updates listing_id on an existing media asset
// ---------------------------------------------------------------------------

export async function attachMediaToListing(
  supabase: SupabaseClient,
  mediaId: string,
  listingId: string
): Promise<void> {
  const profile = await resolveProfile(supabase);
  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) throw new Error('Creator profile required.');

  const listing = await getListingById(supabase, listingId);
  if (!listing) throw new Error('Listing not found.');
  if (listing.creator_id !== creatorProfile.id) throw new Error('You do not own this listing.');

  const media = await getMediaAssetById(supabase, mediaId);
  if (!media) throw new Error('Media asset not found.');
  if (media.owner_id !== profile.id) throw new Error('You do not own this media asset.');

  const { error } = await supabase
    .from('media_assets')
    .update({ listing_id: listingId })
    .eq('id', mediaId);

  if (error) throw new Error(`Failed to attach media to listing: ${error.message}`);
}

// ---------------------------------------------------------------------------
// listCurrentUserMedia
// ---------------------------------------------------------------------------

export async function listCurrentUserMedia(supabase: SupabaseClient): Promise<MediaAsset[]> {
  const profile = await resolveProfile(supabase);
  return listMediaByOwnerId(supabase, profile.id);
}

// ---------------------------------------------------------------------------
// softDeleteCurrentUserMedia
// ---------------------------------------------------------------------------

export async function softDeleteCurrentUserMedia(
  supabase: SupabaseClient,
  mediaId: string
): Promise<void> {
  const profile = await resolveProfile(supabase);
  const media = await getMediaAssetById(supabase, mediaId);
  if (!media) throw new Error('Media asset not found.');
  if (media.owner_id !== profile.id) throw new Error('You do not own this media asset.');
  await softDeleteMediaAsset(supabase, mediaId);
}

// ---------------------------------------------------------------------------
// updateMediaPresentationMetadata
// ---------------------------------------------------------------------------

export async function updateMediaPresentationMetadata(
  supabase: SupabaseClient,
  mediaId: string,
  rawInput: MediaPresentationUpdateInput
): Promise<MediaAsset> {
  const parsed = mediaPresentationUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid update request');
  }
  const input = parsed.data;

  const profile = await resolveProfile(supabase);
  const media = await getMediaAssetById(supabase, mediaId);
  if (!media) throw new Error('Media asset not found.');
  if (media.owner_id !== profile.id) throw new Error('You do not own this media asset.');

  return updateMediaPresentationMetadataRecord(supabase, mediaId, input);
}
