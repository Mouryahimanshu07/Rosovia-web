import type { SupabaseClient } from '@supabase/supabase-js';
import type { ListingCreateInput, ListingUpdateInput, Listing, ListingWithDetails } from '@rosovia/core';
import { generateSlug } from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getListingById,
  getListingBySlug,
  isListingSlugTaken,
  createListing,
  updateListing,
  updateListingStatus,
  listPublicListings,
  listCreatorPublicListings,
  listCurrentCreatorListings,
  type ListListingsParams,
} from './listing.repository';
import type { CreatorProfile } from '@rosovia/core';

export { listPublicListings, listCreatorPublicListings, listCurrentCreatorListings };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildUniqueListingSlug(supabase: SupabaseClient, title: string): Promise<string> {
  const base = generateSlug(title);
  if (!(await isListingSlugTaken(supabase, base))) return base;

  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isListingSlugTaken(supabase, candidate))) return candidate;
  }

  return `${base}-${Math.random().toString(16).slice(2, 8)}`;
}

async function resolveCreatorProfile(
  supabase: SupabaseClient
): Promise<{ userId: string; creatorProfile: CreatorProfile }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.role !== 'creator') throw new Error('Only creators can manage listings');
  if (profile.status !== 'active') throw new Error('Account is not active');

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) throw new Error('Creator profile required. Please complete your creator profile first.');

  return { userId: user.id, creatorProfile };
}

async function assertOwnsListing(
  supabase: SupabaseClient,
  listingId: string,
  creatorProfileId: string
): Promise<Listing> {
  const listing = await getListingById(supabase, listingId);
  if (!listing) throw new Error('Listing not found');
  if (listing.creator_id !== creatorProfileId) throw new Error('You do not own this listing');
  return listing;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function getCurrentCreatorListingDashboardState(
  supabase: SupabaseClient
): Promise<{ creatorProfile: CreatorProfile | null; listings: ListingWithDetails[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { creatorProfile: null, listings: [] };

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) return { creatorProfile: null, listings: [] };

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) return { creatorProfile: null, listings: [] };

  const listings = await listCurrentCreatorListings(supabase, creatorProfile.id);
  return { creatorProfile, listings };
}

export async function createCurrentCreatorListing(
  supabase: SupabaseClient,
  input: ListingCreateInput
): Promise<Listing> {
  const { creatorProfile } = await resolveCreatorProfile(supabase);

  const slug = await buildUniqueListingSlug(supabase, input.title);

  const metadata: Record<string, unknown> = {};
  if (input.metadata?.deliveryDays !== undefined) metadata.deliveryDays = input.metadata.deliveryDays;
  if (input.metadata?.material) metadata.material = input.metadata.material;
  if (input.metadata?.techStack) metadata.techStack = input.metadata.techStack;
  if (input.metadata?.revisionCount !== undefined) metadata.revisionCount = input.metadata.revisionCount;
  if (input.metadata?.fileFormats) metadata.fileFormats = input.metadata.fileFormats;

  return createListing(supabase, {
    creator_id: creatorProfile.id,
    category_id: input.categoryId,
    listing_type: input.listingType,
    title: input.title,
    slug,
    description: input.description ?? null,
    price: input.price ?? null,
    currency: input.currency ?? 'INR',
    stock: input.stock ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    custom_order_available: input.customOrderAvailable,
    delivery_available: input.deliveryAvailable,
    online_available: input.onlineAvailable,
    offline_available: input.offlineAvailable,
    metadata,
  });
}

export async function updateCurrentCreatorListing(
  supabase: SupabaseClient,
  listingId: string,
  input: ListingUpdateInput
): Promise<Listing> {
  const { creatorProfile } = await resolveCreatorProfile(supabase);
  await assertOwnsListing(supabase, listingId, creatorProfile.id);

  const metadata: Record<string, unknown> = {};
  if (input.metadata?.deliveryDays !== undefined) metadata.deliveryDays = input.metadata.deliveryDays;
  if (input.metadata?.material) metadata.material = input.metadata.material;
  if (input.metadata?.techStack) metadata.techStack = input.metadata.techStack;
  if (input.metadata?.revisionCount !== undefined) metadata.revisionCount = input.metadata.revisionCount;
  if (input.metadata?.fileFormats) metadata.fileFormats = input.metadata.fileFormats;

  const safe: Parameters<typeof updateListing>[2] = {};
  if (input.categoryId !== undefined) safe.category_id = input.categoryId;
  if (input.listingType !== undefined) safe.listing_type = input.listingType;
  if (input.title !== undefined) safe.title = input.title;
  if (input.description !== undefined) safe.description = input.description ?? null;
  if (input.price !== undefined) safe.price = input.price ?? null;
  if (input.currency !== undefined) safe.currency = input.currency;
  if (input.stock !== undefined) safe.stock = input.stock ?? null;
  if (input.city !== undefined) safe.city = input.city ?? null;
  if (input.state !== undefined) safe.state = input.state ?? null;
  if (input.customOrderAvailable !== undefined) safe.custom_order_available = input.customOrderAvailable;
  if (input.deliveryAvailable !== undefined) safe.delivery_available = input.deliveryAvailable;
  if (input.onlineAvailable !== undefined) safe.online_available = input.onlineAvailable;
  if (input.offlineAvailable !== undefined) safe.offline_available = input.offlineAvailable;
  if (Object.keys(metadata).length > 0) safe.metadata = metadata;

  const listing = await updateListing(supabase, listingId, safe);
  await cacheHelpers.del(`listing:detail:${listing.slug}`);
  return listing;
}

export async function submitCurrentCreatorListingForReview(
  supabase: SupabaseClient,
  listingId: string
): Promise<Listing> {
  const { creatorProfile } = await resolveCreatorProfile(supabase);
  const listing = await assertOwnsListing(supabase, listingId, creatorProfile.id);

  if (listing.status !== 'draft') {
    throw new Error(`Cannot submit a listing with status "${listing.status}" for review. Only drafts can be submitted.`);
  }

  const updatedListing = await updateListingStatus(supabase, listingId, 'pending_review');
  await cacheHelpers.del(`listing:detail:${updatedListing.slug}`);
  return updatedListing;
}

export async function archiveCurrentCreatorListing(
  supabase: SupabaseClient,
  listingId: string
): Promise<Listing> {
  const { creatorProfile } = await resolveCreatorProfile(supabase);
  const listing = await assertOwnsListing(supabase, listingId, creatorProfile.id);

  if (listing.status === 'suspended') {
    throw new Error('Suspended listings cannot be archived.');
  }
  if (listing.status === 'archived') {
    throw new Error('Listing is already archived.');
  }

  const updatedListing = await updateListingStatus(supabase, listingId, 'archived');
  await cacheHelpers.del(`listing:detail:${updatedListing.slug}`);
  return updatedListing;
}

export async function restoreCurrentCreatorListingToDraft(
  supabase: SupabaseClient,
  listingId: string
): Promise<Listing> {
  const { creatorProfile } = await resolveCreatorProfile(supabase);
  const listing = await assertOwnsListing(supabase, listingId, creatorProfile.id);

  if (!['archived', 'rejected'].includes(listing.status)) {
    throw new Error(`Cannot restore listing with status "${listing.status}" to draft.`);
  }

  const updatedListing = await updateListingStatus(supabase, listingId, 'draft');
  await cacheHelpers.del(`listing:detail:${updatedListing.slug}`);
  return updatedListing;
}

import { cacheHelpers } from '@rosovia/integrations';

export async function getPublicListingBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<ListingWithDetails | null> {
  const cacheKey = `listing:detail:${slug}`;

  // 1. Fetch cache
  const cached = await cacheHelpers.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return parsed as ListingWithDetails;
    } catch {
      // ignore JSON parse error
    }
  }

  // 2. Lock to prevent stampede
  const acquired = await cacheHelpers.acquireLock(cacheKey, 5000);
  if (acquired) {
    try {
      const listing = await getListingBySlug(supabase, slug);
      if (!listing) return null;
      if (listing.status !== 'approved') return null;

      // 3. Write cache
      await cacheHelpers.set(cacheKey, JSON.stringify(listing), 900); // 15 min TTL
      return listing;
    } finally {
      await cacheHelpers.releaseLock(cacheKey);
    }
  } else {
    // Retry fetch after small delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getPublicListingBySlug(supabase, slug);
  }
}


export async function listApprovedPublicListings(
  supabase: SupabaseClient,
  params: ListListingsParams = {}
): Promise<ListingWithDetails[]> {
  return listPublicListings(supabase, params);
}
