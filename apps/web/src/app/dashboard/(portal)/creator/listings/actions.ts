'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCurrentCreatorListing,
  updateCurrentCreatorListing,
  submitCurrentCreatorListingForReview,
  archiveCurrentCreatorListing,
  restoreCurrentCreatorListingToDraft,
} from '@rosovia/api';
import { listingCreateSchema, listingUpdateSchema } from '@rosovia/core';
import type { ListingCreateInput, ListingUpdateInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

export async function createListingAction(input: ListingCreateInput): Promise<ActionResult> {
  const parsed = listingCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  try {
    const supabase = createWebServerClient();
    await createCurrentCreatorListing(supabase, parsed.data);
    revalidatePath('/dashboard/creator/listings');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create listing' };
  }
}

export async function updateListingAction(
  listingId: string,
  input: ListingUpdateInput
): Promise<ActionResult> {
  const parsed = listingUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  try {
    const supabase = createWebServerClient();
    await updateCurrentCreatorListing(supabase, listingId, parsed.data);
    revalidatePath('/dashboard/creator/listings');
    revalidatePath(`/dashboard/creator/listings/${listingId}/edit`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update listing' };
  }
}

export async function submitListingForReviewAction(listingId: string): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await submitCurrentCreatorListingForReview(supabase, listingId);
    revalidatePath('/dashboard/creator/listings');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit for review' };
  }
}

export async function archiveListingAction(listingId: string): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await archiveCurrentCreatorListing(supabase, listingId);
    revalidatePath('/dashboard/creator/listings');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to archive listing' };
  }
}

export async function restoreListingToDraftAction(listingId: string): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await restoreCurrentCreatorListingToDraft(supabase, listingId);
    revalidatePath('/dashboard/creator/listings');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to restore to draft' };
  }
}
