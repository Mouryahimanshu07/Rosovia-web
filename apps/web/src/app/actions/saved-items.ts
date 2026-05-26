'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  toggleSaveListing,
  toggleSaveCreator,
  listSavedListingsForUser,
  listSavedCreatorsForUser,
} from '@rosovia/api';
import { saveListingSchema, saveCreatorSchema } from '@rosovia/core';
import type { SavedListingWithDetails, SavedCreatorWithDetails } from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Listings Toggle / Save Action
// ---------------------------------------------------------------------------

export async function toggleSaveListingAction(
  listingId: string
): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = saveListingSchema.safeParse({ listingId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid listing ID',
    };
  }

  try {
    const supabase = createWebServerClient();
    const result = await toggleSaveListing(supabase, parsed.data.listingId);

    // Revalidate paths that show saving details
    revalidatePath('/dashboard/buyer/saved');
    revalidatePath(`/listings/${listingId}`);

    return { success: true, data: result };
  } catch (err) {
    captureAppError(err, { module: 'saved-items', action: 'toggle_save_listing' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save listing',
    };
  }
}

// ---------------------------------------------------------------------------
// Creators Toggle / Save Action
// ---------------------------------------------------------------------------

export async function toggleSaveCreatorAction(
  creatorProfileId: string
): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = saveCreatorSchema.safeParse({ creatorProfileId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid creator profile ID',
    };
  }

  try {
    const supabase = createWebServerClient();
    const result = await toggleSaveCreator(supabase, parsed.data.creatorProfileId);

    // Revalidate paths
    revalidatePath('/dashboard/buyer/saved');

    return { success: true, data: result };
  } catch (err) {
    captureAppError(err, { module: 'saved-items', action: 'toggle_save_creator' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save creator',
    };
  }
}

// ---------------------------------------------------------------------------
// Read / List Actions
// ---------------------------------------------------------------------------

export async function listSavedListingsAction(): Promise<ActionResult<SavedListingWithDetails[]>> {
  try {
    const supabase = createWebServerClient();
    const list = await listSavedListingsForUser(supabase);
    return { success: true, data: list };
  } catch (err) {
    captureAppError(err, { module: 'saved-items', action: 'list_saved_listings' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch saved listings',
    };
  }
}

export async function listSavedCreatorsAction(): Promise<ActionResult<SavedCreatorWithDetails[]>> {
  try {
    const supabase = createWebServerClient();
    const list = await listSavedCreatorsForUser(supabase);
    return { success: true, data: list };
  } catch (err) {
    captureAppError(err, { module: 'saved-items', action: 'list_saved_creators' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch saved creators',
    };
  }
}
