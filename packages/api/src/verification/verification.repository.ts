import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  VerificationRequest,
  VerificationRequestWithDetails,
  VerificationListParams,
  VerificationRequestStatus,
  PublicRequestableLevel,
} from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal: flatten joined row into VerificationRequestWithDetails
// ---------------------------------------------------------------------------

type RawVerificationRow = VerificationRequest & {
  creator_profiles?: { display_name: string; slug: string } | null;
  media_assets?: {
    storage_key: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  } | null;
  reviewed_by_profile?: { full_name: string | null; username: string | null } | null;
};

function flattenRequest(row: RawVerificationRow): VerificationRequestWithDetails {
  return {
    ...row,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    document_storage_key: row.media_assets?.storage_key ?? null,
    document_mime_type: row.media_assets?.mime_type ?? null,
    document_size_bytes: row.media_assets?.size_bytes ?? null,
    document_uploaded_at: row.media_assets?.created_at ?? null,
    reviewed_by_name:
      row.reviewed_by_profile?.full_name ??
      row.reviewed_by_profile?.username ??
      null,
  };
}

const WITH_DETAILS_SELECT = `
  *,
  creator_profiles ( display_name, slug ),
  media_assets!verification_requests_document_media_id_fkey ( storage_key, mime_type, size_bytes, created_at ),
  reviewed_by_profile:profiles!verification_requests_reviewed_by_fkey ( full_name, username )
`.trim();

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getVerificationRequestById(
  supabase: SupabaseClient,
  id: string
): Promise<VerificationRequestWithDetails | null> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select(WITH_DETAILS_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch verification request: ${error.message}`);
  }
  return flattenRequest(data as unknown as RawVerificationRow);
}

export async function getPendingVerificationRequestByUserAndType(
  supabase: SupabaseClient,
  userId: string,
  verificationType: string
): Promise<VerificationRequest | null> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('verification_type', verificationType)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to check pending request: ${error.message}`);
  return data as VerificationRequest | null;
}

export async function listCurrentUserVerificationRequests(
  supabase: SupabaseClient,
  userProfileId: string,
  params: VerificationListParams = {}
): Promise<VerificationRequestWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('verification_requests')
    .select(WITH_DETAILS_SELECT)
    .eq('user_id', userProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.verificationType) query = query.eq('verification_type', params.verificationType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list user verification requests: ${error.message}`);
  return (data ?? []).map((r) => flattenRequest(r as unknown as RawVerificationRow));
}

export async function listAdminVerificationRequests(
  supabase: SupabaseClient,
  params: VerificationListParams = {}
): Promise<VerificationRequestWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('verification_requests')
    .select(WITH_DETAILS_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.verificationType) query = query.eq('verification_type', params.verificationType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin verification requests: ${error.message}`);
  return (data ?? []).map((r) => flattenRequest(r as unknown as RawVerificationRow));
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function createVerificationRequest(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    creator_id: string | null;
    verification_type: string;
    requested_level: string;
    document_type: string;
    document_media_id: string;
  }
): Promise<VerificationRequest> {
  const { data: created, error } = await supabase
    .from('verification_requests')
    .insert({
      user_id: data.user_id,
      creator_id: data.creator_id,
      verification_type: data.verification_type,
      requested_level: data.requested_level,
      document_type: data.document_type,
      document_media_id: data.document_media_id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create verification request: ${error.message}`);
  return created as VerificationRequest;
}

export async function updateVerificationRequest(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    status: VerificationRequestStatus;
    admin_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
  }>
): Promise<VerificationRequest> {
  const { data: updated, error } = await supabase
    .from('verification_requests')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update verification request: ${error.message}`);
  return updated as VerificationRequest;
}

export async function getMediaAssetForVerification(
  supabase: SupabaseClient,
  mediaId: string
): Promise<{
  id: string;
  owner_id: string;
  media_type: string;
  is_private: boolean;
  status: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
} | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('id, owner_id, media_type, is_private, status, storage_key, mime_type, size_bytes, created_at')
    .eq('id', mediaId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch media asset: ${error.message}`);
  }
  return data;
}

export async function updateCreatorVerificationStatus(
  supabase: SupabaseClient,
  creatorId: string,
  level: PublicRequestableLevel,
  isVerified: boolean
): Promise<void> {
  const { error } = await supabase
    .from('creator_profiles')
    .update({
      verification_level: level,
      is_verified: isVerified,
    })
    .eq('id', creatorId);

  if (error) throw new Error(`Failed to update creator verification status: ${error.message}`);
}
