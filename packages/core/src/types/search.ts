import type { CategoryType } from './category';
import type { ListingType } from './listing';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number | null;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

export type ListingSortOption = 'newest' | 'price_low' | 'price_high';
export type CreatorSortOption = 'newest' | 'rating_high' | 'verified_first';

// ---------------------------------------------------------------------------
// Search param types (inferred from Zod schemas in validators/search.ts)
// These are the parsed/validated versions.
// ---------------------------------------------------------------------------

export interface ListingSearchParams {
  q?: string;
  category?: string;
  listingType?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  state?: string;
  verifiedOnly?: boolean;
  customOrderAvailable?: boolean;
  onlineAvailable?: boolean;
  offlineAvailable?: boolean;
  sort?: ListingSortOption;
  page?: number;
}

export interface CreatorSearchParams {
  q?: string;
  category?: string;
  city?: string;
  state?: string;
  verifiedOnly?: boolean;
  sort?: CreatorSortOption;
  page?: number;
}

export interface CategorySearchParams {
  q?: string;
  type?: CategoryType;
}
