import { z } from 'zod';
import { LISTING_TYPES } from './listing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Coerces URL query-param boolean strings ("true" / "false") to actual booleans.
 * Missing / undefined values become undefined (field is not applied as a filter).
 */
const booleanParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/**
 * Safely parses a string number.  Invalid or missing → undefined.
 */
const nonNegativeNumberParam = z.coerce
  .number()
  .nonnegative()
  .optional()
  .catch(undefined);

const positiveIntParam = z.coerce
  .number()
  .int()
  .positive()
  .optional()
  .catch(undefined);

const CATEGORY_TYPES = [
  'product',
  'service',
  'learning',
  'performance',
  'mixed',
] as const;

// ---------------------------------------------------------------------------
// Listing search params
// ---------------------------------------------------------------------------

export const listingSearchParamsSchema = z.object({
  q:                    z.string().max(100).optional(),
  category:             z.string().optional(),
  listingType:          z.enum(LISTING_TYPES).optional(),
  minPrice:             nonNegativeNumberParam,
  maxPrice:             nonNegativeNumberParam,
  city:                 z.string().max(80).optional(),
  state:                z.string().max(80).optional(),
  verifiedOnly:         booleanParam,
  customOrderAvailable: booleanParam,
  onlineAvailable:      booleanParam,
  offlineAvailable:     booleanParam,
  sort: z
    .enum(['newest', 'price_low', 'price_high', 'rating_high', 'relevance', 'trending'])
    .optional()
    .default('newest'),
  page: positiveIntParam,
});

export type ListingSearchParamsInput = z.infer<typeof listingSearchParamsSchema>;

// ---------------------------------------------------------------------------
// Creator search params
// ---------------------------------------------------------------------------

export const creatorSearchParamsSchema = z.object({
  q:            z.string().max(100).optional(),
  category:     z.string().optional(),
  city:         z.string().max(80).optional(),
  state:        z.string().max(80).optional(),
  verifiedOnly: booleanParam,
  sort: z
    .enum(['newest', 'rating_high', 'verified_first'])
    .optional()
    .default('newest'),
  page: positiveIntParam,
});

export type CreatorSearchParamsInput = z.infer<typeof creatorSearchParamsSchema>;

// ---------------------------------------------------------------------------
// Category search params
// ---------------------------------------------------------------------------

export const categorySearchParamsSchema = z.object({
  q:    z.string().max(100).optional(),
  type: z.enum(CATEGORY_TYPES).optional(),
});

export type CategorySearchParamsInput = z.infer<typeof categorySearchParamsSchema>;
