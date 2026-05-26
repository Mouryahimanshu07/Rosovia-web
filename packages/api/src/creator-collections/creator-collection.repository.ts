// packages/api/src/creator-collections/creator-collection.repository.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorCollection, CollectionItemWithListing } from '@rosovia/core';

export async function createCollection(
  supabase: SupabaseClient,
  creatorId: string,
  name: string,
  slug: string,
  description?: string | null
): Promise<CreatorCollection> {
  const { data, error } = await supabase
    .from('creator_collections')
    .insert({
      creator_id: creatorId,
      name,
      slug,
      description: description ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }
  return data as CreatorCollection;
}

export async function updateCollection(
  supabase: SupabaseClient,
  collectionId: string,
  name?: string,
  slug?: string,
  description?: string | null
): Promise<CreatorCollection> {
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (description !== undefined) updateData.description = description ?? null;

  const { data, error } = await supabase
    .from('creator_collections')
    .update(updateData)
    .eq('id', collectionId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update collection: ${error.message}`);
  }
  return data as CreatorCollection;
}

export async function deleteCollection(
  supabase: SupabaseClient,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('creator_collections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', collectionId);

  if (error) {
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}

export async function getCollectionById(
  supabase: SupabaseClient,
  collectionId: string
): Promise<CreatorCollection | null> {
  const { data, error } = await supabase
    .from('creator_collections')
    .select('*')
    .eq('id', collectionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch collection by ID: ${error.message}`);
  }
  return data as CreatorCollection | null;
}

export async function getCollectionBySlug(
  supabase: SupabaseClient,
  creatorId: string,
  slug: string
): Promise<CreatorCollection | null> {
  const { data, error } = await supabase
    .from('creator_collections')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch collection by slug: ${error.message}`);
  }
  return data as CreatorCollection | null;
}

export async function listCollectionsForCreator(
  supabase: SupabaseClient,
  creatorId: string,
  includeDeleted = false
): Promise<CreatorCollection[]> {
  let query = supabase
    .from('creator_collections')
    .select('*')
    .eq('creator_id', creatorId);

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list collections for creator: ${error.message}`);
  }
  return data as CreatorCollection[];
}

export async function addCollectionItem(
  supabase: SupabaseClient,
  collectionId: string,
  listingId: string,
  sortOrder = 0
): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .insert({
      collection_id: collectionId,
      listing_id: listingId,
      sort_order: sortOrder,
    });

  if (error) {
    if (error.code === '23505') return; // Safe duplicate ignore
    throw new Error(`Failed to add collection item: ${error.message}`);
  }
}

export async function removeCollectionItem(
  supabase: SupabaseClient,
  collectionId: string,
  listingId: string
): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('listing_id', listingId);

  if (error) {
    throw new Error(`Failed to remove collection item: ${error.message}`);
  }
}

export async function updateCollectionItemSortOrder(
  supabase: SupabaseClient,
  itemId: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .update({ sort_order: sortOrder })
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to update collection item sort order: ${error.message}`);
  }
}

export async function listCollectionItems(
  supabase: SupabaseClient,
  collectionId: string
): Promise<CollectionItemWithListing[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*, listings:listing_id ( *, categories ( name ), creator_profiles ( display_name, slug ) )')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to list collection items: ${error.message}`);
  }

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
  }) as CollectionItemWithListing[];
}
