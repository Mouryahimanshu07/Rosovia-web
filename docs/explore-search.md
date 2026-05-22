# Search & Discovery — Rosovia

Rosovia implements public discovery using **PostgreSQL full-text ILIKE search** with `pg_trgm` trigram indexes. Search runs entirely in-database — no external search provider is required at current scale.

---

## Scope

| Area | Status |
|---|---|
| `/explore` page | ✅ Implemented |
| `/categories` page | ✅ Implemented |
| `/categories/[slug]` page | ✅ Implemented |
| `/creators` page with filters | ✅ Implemented |
| `/listings` page with filters | ✅ Implemented |
| PostgreSQL ILIKE search | ✅ Implemented |
| Zod query-param validation | ✅ Implemented |
| Pagination (page/pageSize=12) | ✅ Implemented |
| Search/filter UI components | ✅ Implemented |
| Database search indexes | ✅ Migration 005 |

---

## Public Pages

### `/explore`

- Hero section with global SearchBar
- Category quick-links (all active categories)
- Latest 12 approved listings grid
- Latest 8 creator profiles
- If `?q=` is present: shows search results instead
- Links to `/listings`, `/creators`, `/categories`

### `/categories`

- All active categories sorted by priority
- Filters: `?q=` (search name/description/slug), `?type=` (product/service/learning/performance/mixed)
- `CategoryFilterTabs` for type filtering
- `CategoryCard` grid

### `/categories/[slug]`

- Returns 404 if category slug is inactive or not found
- Category header with name, description, type badge
- Sidebar `FilterPanel` for listing filters
- Paginated approved listings grid for this category
- Creators whose `primary_category_id` is this category
- Supported filters: `q`, `listingType`, `minPrice`, `maxPrice`, `city`, `state`, `verifiedOnly`, `onlineAvailable`, `offlineAvailable`, `page`, `sort`

### `/creators`

- Sidebar `FilterPanel` for creator filters
- Filters: `q`, `category`, `city`, `state`, `verifiedOnly`, `sort`, `page`
- Sort options: `newest` | `rating_high` | `verified_first`
- Paginated `CreatorProfileCard` grid
- `ActiveFilters` pills showing active filters

### `/listings`

- Sidebar `FilterPanel` for listing filters
- Filters: `q`, `category`, `listingType`, `minPrice`, `maxPrice`, `city`, `state`, `verifiedOnly`, `customOrderAvailable`, `onlineAvailable`, `offlineAvailable`, `sort`, `page`
- Sort options: `newest` | `price_low` | `price_high`
- Paginated `ListingCard` grid
- `ActiveFilters` pills showing active filters

---

## Search Params Reference

### Listing search params

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string (max 100) | — | Full-text search on title, description, city, state |
| `category` | string (UUID) | — | Filter by category ID |
| `listingType` | enum | — | product/service/mentorship/workshop/event_booking/portfolio |
| `minPrice` | number ≥ 0 | — | Minimum price |
| `maxPrice` | number ≥ 0 | — | Maximum price |
| `city` | string (max 80) | — | City ILIKE filter |
| `state` | string (max 80) | — | State ILIKE filter |
| `verifiedOnly` | boolean | — | Only verified creators' listings |
| `customOrderAvailable` | boolean | — | Accepts custom orders |
| `onlineAvailable` | boolean | — | Available online |
| `offlineAvailable` | boolean | — | Available in-person |
| `sort` | enum | `newest` | newest/price_low/price_high |
| `page` | positive int | `1` | Page number |

### Creator search params

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string (max 100) | — | Full-text search on display_name, bio, story, city, state |
| `category` | string (UUID) | — | Filter by primary_category_id |
| `city` | string (max 80) | — | City ILIKE filter |
| `state` | string (max 80) | — | State ILIKE filter |
| `verifiedOnly` | boolean | — | Only verified creators |
| `sort` | enum | `newest` | newest/rating_high/verified_first |
| `page` | positive int | `1` | Page number |

### Category search params

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string (max 100) | — | Search category name/description/slug |
| `type` | enum | — | product/service/learning/performance/mixed |

---

## Validation

All search params are validated in `packages/core/src/validators/search.ts` using Zod.

- **Boolean coercion**: `"true"` → `true`, `"false"` → `false`. Missing values are `undefined` (filter not applied).
- **Number coercion**: Uses `z.coerce.number()` with `.catch(undefined)` — invalid numbers are silently ignored.
- **Invalid enums**: Fall back to default value or undefined (do not crash the page).

---

## PostgreSQL Search Strategy

Module 7 uses **ILIKE-based search** via Supabase PostgREST `.or()` and `.ilike()` methods. No raw SQL with user-interpolated strings.

```
listing search: title ILIKE %q%, description ILIKE %q%, city ILIKE %q%, state ILIKE %q%
creator search: display_name ILIKE %q%, bio ILIKE %q%, story ILIKE %q%, city ILIKE %q%, state ILIKE %q%
category search: name ILIKE %q%, description ILIKE %q%, slug ILIKE %q%
```

### Pagination

- `pageSize = 12`
- Uses Supabase `.range(offset, offset + pageSize - 1)`
- Count query runs in parallel via `select('*', { count: 'exact', head: true })`
- Returns `PaginatedResult<T>` with `PaginationMeta` (page, pageSize, total, hasNext, hasPrev)
- `Pagination` component preserves all existing query params in links

---

## Search Migrations

### Migration 005

`packages/database/supabase/migrations/005_explore_search_indexes.sql`

Additive only — no table changes, no column drops.

Adds:
- `pg_trgm` extension (`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
- GIN trigram indexes on `listings.title`, `listings.description`, `creator_profiles.display_name`, `creator_profiles.bio`
- Partial compound indexes for common approved-listing queries
- `lower(...)` indexes for case-insensitive field lookups
- Category priority + type indexes

### Migration 024

`packages/database/supabase/migrations/024_search_optimization.sql`

Additional performance indexes added after load analysis:
- Additional compound indexes on `listings` for common filter combinations (category + status + created_at)
- Additional trigram indexes on `creator_profiles.story`
- Partial indexes for `deleted_at IS NULL` conditions

### PostgreSQL vs External Search

| Approach | Current | Future Scale |
|---|---|---|
| Engine | PostgreSQL ILIKE + `pg_trgm` GIN | External: Typesense or Meilisearch |
| Relevance ranking | Basic ILIKE match | TF-IDF / BM25 / vector |
| Typo tolerance | Partial (trigram similarity) | Full |
| Faceted filtering | URL query params + SQL | Native facets |
| Real-time index | Immediate (in-DB) | Replication lag |

At current scale, PostgreSQL search is sufficient and avoids the operational complexity of a separate search cluster. The search service layer (`packages/api/src/search/`) is abstracted behind a consistent interface, making it straightforward to swap in Typesense or Meilisearch when query volume requires it.

---

## Security Rules

- **Listings visibility**: Only exposed if:
  - `status = 'approved'` AND `deleted_at IS NULL`
  - Linked creator profile `deleted_at IS NULL`
  - Linked base profile `status = 'active'` AND `deleted_at IS NULL`
- **Creators visibility**: Only exposed if:
  - `deleted_at IS NULL`
  - Linked base profile `status = 'active'` AND `deleted_at IS NULL`
- Only `is_active = true` categories are returned.
- All query params are validated server-side with Zod before any database query.
- No service-role key is used in any public page.
- No raw SQL with interpolated user input. All user values are passed as Supabase parameterized query values.

---

## Current Limitations & Future Work

| Feature | Status |
|---|---|
| External search (Typesense, Meilisearch) | ❌ Not implemented — PostgreSQL is sufficient at current scale |
| AI / vector / semantic search | ❌ Not implemented |
| Redis caching for search results | ❌ Not implemented |
| Real-time search suggestions | ❌ Not implemented |
| Saved searches | ❌ Not implemented |
| Promoted / sponsored listings | ❌ Not implemented |
| Listing count per category card | ❌ Not implemented |
| Infinite scroll | ❌ Simple prev/next pagination only |

---

