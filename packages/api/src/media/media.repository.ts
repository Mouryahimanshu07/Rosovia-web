import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaAsset, MediaStatus } from '@rosovia/core';

export interface CreateMediaAssetData {
  owner_id: string;
  listing_id?: string | null;
  media_type: string;
  storage_provider: 'cloudflare_r2';
  storage_key: string;
  public_url?: string | null;
  thumbnail_url?: string | null;
  size_bytes: number;
  mime_type: string;
  duration_seconds?: number | null;
  is_private: boolean;
  status: 'uploaded' | 'processing';
}

export async function getMediaAssetById(
  supabase: SupabaseClient,
  id: string
): Promise<MediaAsset | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch media asset: ${error.message}`);
  }
  return data as MediaAsset;
}

export async function listMediaByOwnerId(
  supabase: SupabaseClient,
  ownerId: string
): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list media: ${error.message}`);
  return (data ?? []) as MediaAsset[];
}

export async function listCreatorPublicPortfolioMedia(
  supabase: SupabaseClient,
  ownerId: string
): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_private', false)
    .in('status', ['uploaded', 'ready'])
    .is('deleted_at', null)
    .is('listing_id', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list creator public portfolio media: ${error.message}`);
  return (data ?? []) as MediaAsset[];
}

export async function listMediaByListingId(
  supabase: SupabaseClient,
  listingId: string
): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('listing_id', listingId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list listing media: ${error.message}`);
  return (data ?? []) as MediaAsset[];
}

export async function createMediaAsset(
  supabase: SupabaseClient,
  data: CreateMediaAssetData
): Promise<MediaAsset> {
  const { data: created, error } = await supabase
    .from('media_assets')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create media asset: ${error.message}`);
  return created as MediaAsset;
}

export async function updateMediaAsset(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    status: MediaStatus;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    public_url: string | null;
  }>
): Promise<MediaAsset> {
  const { data: updated, error } = await supabase
    .from('media_assets')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update media asset: ${error.message}`);
  return updated as MediaAsset;
}

export async function softDeleteMediaAsset(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('media_assets')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to soft-delete media asset: ${error.message}`);
}

export async function updateMediaPresentationMetadataRecord(
  supabase: SupabaseClient,
  id: string,
  data: {
    alt_text?: string | null;
    sort_order?: number;
  }
): Promise<MediaAsset> {
  const { data: updated, error } = await supabase
    .from('media_assets')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update media presentation metadata: ${error.message}`);
  return updated as MediaAsset;
}
