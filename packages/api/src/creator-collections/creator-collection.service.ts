// packages/api/src/creator-collections/creator-collection.service.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSlug, type CollectionWithItems, type CreatorCollection, type CollectionItemWithListing } from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { getListingById } from '../listings/listing.repository';
import {
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionById,
  getCollectionBySlug,
  listCollectionsForCreator,
  addCollectionItem,
  removeCollectionItem,
  listCollectionItems,
} from './creator-collection.repository';

// ---------------------------------------------------------------------------
// Internal helper: resolve active creator profile ID
// ---------------------------------------------------------------------------
async function resolveActiveCreatorProfileId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.role !== 'creator') throw new Error('Only creators can perform this action');
  if (profile.status !== 'active') throw new Error('Creator account is suspended');

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) throw new Error('Creator profile not found');

  return creatorProfile.id;
}

// ---------------------------------------------------------------------------
// Internal helper: check collection ownership
// ---------------------------------------------------------------------------
async function checkCollectionOwnership(
  supabase: SupabaseClient,
  collectionId: string,
  creatorId: string
): Promise<void> {
  const collection = await getCollectionById(supabase, collectionId);
  if (!collection) throw new Error('Collection not found');
  if (collection.creator_id !== creatorId) {
    throw new Error('Not authorized to modify this collection');
  }
}

// ---------------------------------------------------------------------------
// Internal helper: build unique slug for a collection per creator
// ---------------------------------------------------------------------------
async function buildUniqueCollectionSlug(
  supabase: SupabaseClient,
  creatorId: string,
  name: string
): Promise<string> {
  const base = generateSlug(name);
  let candidate = base;
  let count = 1;

  while (true) {
    const existing = await getCollectionBySlug(supabase, creatorId, candidate);
    if (!existing) return candidate;
    count++;
    candidate = `${base}-${count}`;
  }
}

// ---------------------------------------------------------------------------
// Service operations
// ---------------------------------------------------------------------------

export async function createCollectionForCreator(
  supabase: SupabaseClient,
  name: string,
  description?: string | null
): Promise<CreatorCollection> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  const slug = await buildUniqueCollectionSlug(supabase, creatorId, name);

  return createCollection(supabase, creatorId, name, slug, description);
}

export async function updateCollectionForCreator(
  supabase: SupabaseClient,
  collectionId: string,
  data: { name?: string; description?: string | null }
): Promise<CreatorCollection> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  await checkCollectionOwnership(supabase, collectionId, creatorId);

  let newSlug: string | undefined;
  if (data.name !== undefined) {
    // Generate new unique slug if name changed
    const current = await getCollectionById(supabase, collectionId);
    if (current && current.name !== data.name) {
      newSlug = await buildUniqueCollectionSlug(supabase, creatorId, data.name);
    }
  }

  return updateCollection(supabase, collectionId, data.name, newSlug, data.description);
}

export async function deleteCollectionForCreator(
  supabase: SupabaseClient,
  collectionId: string
): Promise<void> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  await checkCollectionOwnership(supabase, collectionId, creatorId);

  await deleteCollection(supabase, collectionId);
}

export async function addListingToCollection(
  supabase: SupabaseClient,
  collectionId: string,
  listingId: string,
  sortOrder = 0
): Promise<void> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  await checkCollectionOwnership(supabase, collectionId, creatorId);

  // Security: check that the listing belongs to this creator and is active/approved
  const listing = await getListingById(supabase, listingId);
  if (!listing) throw new Error('Listing not found');
  if (listing.creator_id !== creatorId) {
    throw new Error('Not authorized to add this listing: ownership mismatch');
  }

  await addCollectionItem(supabase, collectionId, listingId, sortOrder);
}

export async function removeListingFromCollection(
  supabase: SupabaseClient,
  collectionId: string,
  listingId: string
): Promise<void> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  await checkCollectionOwnership(supabase, collectionId, creatorId);

  await removeCollectionItem(supabase, collectionId, listingId);
}

export async function listCollectionsForPublicProfile(
  supabase: SupabaseClient,
  creatorId: string
): Promise<CollectionWithItems[]> {
  const collections = await listCollectionsForCreator(supabase, creatorId, false);

  const result: CollectionWithItems[] = [];
  for (const collection of collections) {
    const items = await listCollectionItems(supabase, collection.id);
    // Filter out items whose listings are not approved or are deleted
    const filteredItems = items.filter(item => {
      const listing = item.listings;
      return listing && listing.status === 'approved' && !listing.deleted_at;
    });

    result.push({
      ...collection,
      items: filteredItems,
    });
  }

  return result;
}

export async function listCollectionsForCreatorDashboard(
  supabase: SupabaseClient
): Promise<CollectionWithItems[]> {
  const creatorId = await resolveActiveCreatorProfileId(supabase);
  const collections = await listCollectionsForCreator(supabase, creatorId, false);

  const result: CollectionWithItems[] = [];
  for (const collection of collections) {
    const items = await listCollectionItems(supabase, collection.id);
    // Filter out items that have no valid listing (due to cascade delete)
    const validItems = items.filter(item => !!item.listings && !item.listings.deleted_at);

    result.push({
      ...collection,
      items: validItems,
    });
  }

  return result;
}
