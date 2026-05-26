// packages/api/src/saved-items/saved-item.service.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedListingWithDetails, SavedCreatorWithDetails } from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import {
  isListingSaved,
  isCreatorSaved,
  saveListing,
  unsaveListing,
  saveCreator,
  unsaveCreator,
  listSavedListings,
  listSavedCreators,
} from './saved-item.repository';

// ---------------------------------------------------------------------------
// Internal helper: resolve authenticated profile ID
// ---------------------------------------------------------------------------

async function resolveUserProfileId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('User profile not found');
  if (profile.status !== 'active') throw new Error('User account is suspended');

  return profile.id;
}

// ---------------------------------------------------------------------------
// Saved Listing Actions
// ---------------------------------------------------------------------------

export async function isListingSavedForUser(
  supabase: SupabaseClient,
  listingId: string
): Promise<boolean> {
  try {
    const profileId = await resolveUserProfileId(supabase);
    return await isListingSaved(supabase, profileId, listingId);
  } catch {
    // If not authenticated or other error, treat as unsaved
    return false;
  }
}

export async function toggleSaveListing(
  supabase: SupabaseClient,
  listingId: string
): Promise<{ saved: boolean }> {
  const profileId = await resolveUserProfileId(supabase);
  const alreadySaved = await isListingSaved(supabase, profileId, listingId);

  if (alreadySaved) {
    await unsaveListing(supabase, profileId, listingId);
    return { saved: false };
  } else {
    await saveListing(supabase, profileId, listingId);
    return { saved: true };
  }
}

export async function listSavedListingsForUser(
  supabase: SupabaseClient
): Promise<SavedListingWithDetails[]> {
  const profileId = await resolveUserProfileId(supabase);
  return await listSavedListings(supabase, profileId);
}

// ---------------------------------------------------------------------------
// Saved Creator Actions
// ---------------------------------------------------------------------------

export async function isCreatorSavedForUser(
  supabase: SupabaseClient,
  creatorProfileId: string
): Promise<boolean> {
  try {
    const profileId = await resolveUserProfileId(supabase);
    return await isCreatorSaved(supabase, profileId, creatorProfileId);
  } catch {
    return false;
  }
}

export async function toggleSaveCreator(
  supabase: SupabaseClient,
  creatorProfileId: string
): Promise<{ saved: boolean }> {
  const profileId = await resolveUserProfileId(supabase);
  const alreadySaved = await isCreatorSaved(supabase, profileId, creatorProfileId);

  if (alreadySaved) {
    await unsaveCreator(supabase, profileId, creatorProfileId);
    return { saved: false };
  } else {
    await saveCreator(supabase, profileId, creatorProfileId);
    return { saved: true };
  }
}

export async function listSavedCreatorsForUser(
  supabase: SupabaseClient
): Promise<SavedCreatorWithDetails[]> {
  const profileId = await resolveUserProfileId(supabase);
  return await listSavedCreators(supabase, profileId);
}
