// packages/core/src/types/creator-collection.ts

import type { Listing } from './listing';

export interface CreatorCollection {
  id: string;
  creator_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  listing_id: string;
  sort_order: number;
  created_at: string;
}

export interface CollectionItemWithListing extends CollectionItem {
  listings: (Listing & {
    category_name: string | null;
    creator_display_name: string | null;
    creator_slug: string | null;
  }) | null;
}

export interface CollectionWithItems extends CreatorCollection {
  items: CollectionItemWithListing[];
}
