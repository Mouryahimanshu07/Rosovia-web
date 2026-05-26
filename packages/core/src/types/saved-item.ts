// packages/core/src/types/saved-item.ts

import type { Listing } from './listing';
import type { CreatorProfile } from './creator-profile';

export interface SavedListing {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface SavedCreator {
  id: string;
  user_id: string;
  creator_profile_id: string;
  created_at: string;
}

export interface SavedListingWithDetails extends SavedListing {
  listings: Listing & {
    creator_display_name: string | null;
    creator_slug: string | null;
    category_name: string | null;
  };
}

export interface SavedCreatorWithDetails extends SavedCreator {
  creator_profiles: CreatorProfile & {
    category_name: string | null;
    category_slug: string | null;
  };
}
