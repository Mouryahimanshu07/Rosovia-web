// packages/api/src/saved-items/saved-item.repository.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedListingWithDetails, SavedCreatorWithDetails } from '@rosovia/core';

export async function isListingSaved(
  supabase: SupabaseClient,
  userId: string,
  listingId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check if listing is saved: ${error.message}`);
  }
  return !!data;
}

export async function isCreatorSaved(
  supabase: SupabaseClient,
  userId: string,
  creatorProfileId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_creators')
    .select('id')
    .eq('user_id', userId)
    .eq('creator_profile_id', creatorProfileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check if creator is saved: ${error.message}`);
  }
  return !!data;
}

export async function saveListing(
  supabase: SupabaseClient,
  userId: string,
  listingId: string
): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .insert({ user_id: userId, listing_id: listingId });

  if (error) {
    // Unique violation (P23505/23505 in PG) is treated as a safe no-op
    if (error.code === '23505') return;
    throw new Error(`Failed to save listing: ${error.message}`);
  }
}

export async function unsaveListing(
  supabase: SupabaseClient,
  userId: string,
  listingId: string
): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);

  if (error) {
    throw new Error(`Failed to unsave listing: ${error.message}`);
  }
}

export async function saveCreator(
  supabase: SupabaseClient,
  userId: string,
  creatorProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('saved_creators')
    .insert({ user_id: userId, creator_profile_id: creatorProfileId });

  if (error) {
    if (error.code === '23505') return;
    throw new Error(`Failed to save creator: ${error.message}`);
  }
}

export async function unsaveCreator(
  supabase: SupabaseClient,
  userId: string,
  creatorProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('saved_creators')
    .delete()
    .eq('user_id', userId)
    .eq('creator_profile_id', creatorProfileId);

  if (error) {
    throw new Error(`Failed to unsave creator: ${error.message}`);
  }
}

export async function listSavedListings(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedListingWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('*, listings:listing_id ( *, categories ( name ), creator_profiles ( display_name, slug ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list saved listings: ${error.message}`);
  }

  // Map and flatten properties in detail joins
  return (data || []).map((row: any) => {
    const listing = row.listings;
    return {
      ...row,
      listings: listing ? {
        ...listing,
        category_name: listing.categories?.name ?? null,
        creator_display_name: listing.creator_profiles?.display_name ?? null,
        creator_slug: listing.creator_profiles?.slug ?? null,
      } : null,
    };
  }) as SavedListingWithDetails[];
}

export async function listSavedCreators(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedCreatorWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_creators')
    .select('*, creator_profiles:creator_profile_id ( *, categories:primary_category_id ( name, slug ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list saved creators: ${error.message}`);
  }

  return (data || []).map((row: any) => {
    const profile = row.creator_profiles;
    return {
      ...row,
      creator_profiles: profile ? {
        ...profile,
        category_name: profile.categories?.name ?? null,
        category_slug: profile.categories?.slug ?? null,
      } : null,
    };
  }) as SavedCreatorWithDetails[];
}
