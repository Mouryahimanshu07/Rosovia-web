import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  VerificationRequest,
  VerificationRequestWithDetails,
  VerificationRequestCreateInput,
  VerificationReviewInput,
  VerificationListParams,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getVerificationRequestById,
  getPendingVerificationRequestByUserAndType,
  createVerificationRequest,
  updateVerificationRequest,
  listCurrentUserVerificationRequests,
  listAdminVerificationRequests,
  getMediaAssetForVerification,
  updateCreatorVerificationStatus,
} from './verification.repository';

export {
  getVerificationRequestById,
  listCurrentUserVerificationRequests,
};

// ---------------------------------------------------------------------------
// Internal: resolve active profile from auth session
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
// 1. Creator: submit a verification request
// ---------------------------------------------------------------------------

export async function createCurrentCreatorVerificationRequest(
  supabase: SupabaseClient,
  input: VerificationRequestCreateInput
): Promise<VerificationRequest> {
  // 1. Authenticate and verify active profile
  const profile = await resolveActiveProfile(supabase);

  // 2. Must be a creator role
  if (profile.role !== 'creator') {
    throw new Error('Only creators can submit verification requests');
  }

  // 3. Creator profile must exist
  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) {
    throw new Error('Creator profile not found. Please complete your creator profile first.');
  }

  // 4. requested_level cannot be trusted_seller (enforced here + DB constraint)
  if (input.requestedLevel === ('trusted_seller' as string)) {
    throw new Error('trusted_seller level cannot be requested publicly');
  }

  // 5. No existing pending request for the same verification_type
  const existingPending = await getPendingVerificationRequestByUserAndType(
    supabase,
    profile.id,
    input.verificationType
  );
  if (existingPending) {
    throw new Error(
      `You already have a pending ${input.verificationType} verification request. Please wait for it to be reviewed.`
    );
  }

  // 6. Validate the media asset
  const media = await getMediaAssetForVerification(supabase, input.documentMediaId);
  if (!media) {
    throw new Error('Document not found. Please upload or select a valid document.');
  }

  // 7. Media must belong to this user
  if (media.owner_id !== profile.id) {
    throw new Error('Document does not belong to your account');
  }

  // 8. Media must be private
  if (!media.is_private) {
    throw new Error('Verification documents must be private. Please upload the document with private mode enabled.');
  }

  // 9. Media type must be document or image
  if (media.media_type !== 'document' && media.media_type !== 'image') {
    throw new Error('Verification documents must be a document or image file type.');
  }

  // 10. Media must be uploaded or ready
  if (media.status !== 'uploaded' && media.status !== 'ready') {
    throw new Error('Document is not ready. Please wait for the upload to complete or try again.');
  }

  // 11. Create the verification request
  return createVerificationRequest(supabase, {
    user_id: profile.id,
    creator_id: creatorProfile.id,
    verification_type: input.verificationType,
    requested_level: input.requestedLevel,
    document_type: input.documentType,
    document_media_id: input.documentMediaId,
  });
}

// ---------------------------------------------------------------------------
// 2. Creator: list own verification requests
// ---------------------------------------------------------------------------

export async function listVerificationRequestsForCurrentUser(
  supabase: SupabaseClient,
  params: VerificationListParams = {}
): Promise<VerificationRequestWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentUserVerificationRequests(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// 3. Creator: get verification dashboard state
// ---------------------------------------------------------------------------

export async function getCurrentCreatorVerificationDashboardState(supabase: SupabaseClient): Promise<{
  creatorProfile: { verification_level: string; is_verified: boolean; display_name: string; slug: string } | null;
  pendingRequests: VerificationRequestWithDetails[];
  latestRequest: VerificationRequestWithDetails | null;
  allRequests: VerificationRequestWithDetails[];
}> {
  const profile = await resolveActiveProfile(supabase);

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);

  if (!creatorProfile) {
    return {
      creatorProfile: null,
      pendingRequests: [],
      latestRequest: null,
      allRequests: [],
    };
  }

  const allRequests = await listCurrentUserVerificationRequests(supabase, profile.id);
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const latestRequest = allRequests[0] ?? null;

  return {
    creatorProfile: {
      verification_level: creatorProfile.verification_level,
      is_verified: creatorProfile.is_verified,
      display_name: creatorProfile.display_name,
      slug: creatorProfile.slug,
    },
    pendingRequests,
    latestRequest,
    allRequests,
  };
}

// ---------------------------------------------------------------------------
// 4. Admin: list verification requests for review
// ---------------------------------------------------------------------------

export async function listVerificationRequestsForAdmin(
  supabase: SupabaseClient,
  params: VerificationListParams = {}
): Promise<VerificationRequestWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return listAdminVerificationRequests(supabase, params);
}

// ---------------------------------------------------------------------------
// 5. Admin: approve or reject a verification request
// ---------------------------------------------------------------------------

export async function reviewVerificationRequestAsAdmin(
  supabase: SupabaseClient,
  input: VerificationReviewInput
): Promise<VerificationRequest> {
  // 1. Authenticate and verify admin profile
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'admin') {
    throw new Error('Admin access required');
  }

  // 2. Fetch the request
  const request = await getVerificationRequestById(supabase, input.verificationRequestId);
  if (!request) {
    throw new Error('Verification request not found');
  }

  // 3. Must be pending to review
  if (request.status !== 'pending') {
    throw new Error(`This request has already been ${request.status}. It cannot be reviewed again.`);
  }

  // 4. Admin cannot review their own request
  if (request.user_id === profile.id) {
    throw new Error('You cannot review your own verification request');
  }

  const reviewedAt = new Date().toISOString();

  // 5. Handle approve
  if (input.decision === 'approve') {
    // Update the request status
    const updated = await updateVerificationRequest(supabase, request.id, {
      status: 'approved',
      admin_note: input.adminNote ?? null,
      reviewed_by: profile.id,
      reviewed_at: reviewedAt,
    });

    // Update creator profile verification fields
    if (request.creator_id) {
      await updateCreatorVerificationStatus(
        supabase,
        request.creator_id,
        request.requested_level,
        true
      );
    }

    return updated;
  }

  // 6. Handle reject
  const updated = await updateVerificationRequest(supabase, request.id, {
    status: 'rejected',
    admin_note: input.adminNote ?? null,
    reviewed_by: profile.id,
    reviewed_at: reviewedAt,
  });

  // NOTE: Rejection does NOT change creator_profiles.verification_level or is_verified.
  // The creator's existing approved level (if any) is preserved.

  return updated;
}
