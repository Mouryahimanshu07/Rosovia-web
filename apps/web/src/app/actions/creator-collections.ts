'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCollectionForCreator,
  updateCollectionForCreator,
  deleteCollectionForCreator,
  addListingToCollection,
  removeListingFromCollection,
} from '@rosovia/api';
import {
  createCollectionSchema,
  updateCollectionSchema,
} from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createCollectionAction(
  name: string,
  description?: string | null
): Promise<ActionResult> {
  const parsed = createCollectionSchema.safeParse({ name, description });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input data',
    };
  }

  try {
    const supabase = createWebServerClient();
    await createCollectionForCreator(
      supabase,
      parsed.data.name,
      parsed.data.description
    );

    revalidatePath('/dashboard/creator/collections');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'creator-collections', action: 'create_collection' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create collection',
    };
  }
}

export async function updateCollectionAction(
  collectionId: string,
  data: { name?: string; description?: string | null }
): Promise<ActionResult> {
  const parsed = updateCollectionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input data',
    };
  }

  try {
    const supabase = createWebServerClient();
    await updateCollectionForCreator(supabase, collectionId, parsed.data);

    revalidatePath('/dashboard/creator/collections');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'creator-collections', action: 'update_collection' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update collection',
    };
  }
}

export async function deleteCollectionAction(
  collectionId: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await deleteCollectionForCreator(supabase, collectionId);

    revalidatePath('/dashboard/creator/collections');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'creator-collections', action: 'delete_collection' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete collection',
    };
  }
}

export async function addListingToCollectionAction(
  collectionId: string,
  listingId: string,
  sortOrder = 0
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await addListingToCollection(supabase, collectionId, listingId, sortOrder);

    revalidatePath('/dashboard/creator/collections');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'creator-collections', action: 'add_listing_to_collection' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add listing to collection',
    };
  }
}

export async function removeListingFromCollectionAction(
  collectionId: string,
  listingId: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await removeListingFromCollection(supabase, collectionId, listingId);

    revalidatePath('/dashboard/creator/collections');
    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'creator-collections', action: 'remove_listing_from_collection' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove listing from collection',
    };
  }
}
