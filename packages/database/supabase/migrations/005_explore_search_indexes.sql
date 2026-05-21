-- =============================================================================
-- Rosovia Module 7: Explore/Search — Performance Indexes
-- Migration: 005_explore_search_indexes.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 003_listings.sql
-- Purpose: Add search-optimised indexes.
--          No data model changes. No new tables. Fully additive.
-- =============================================================================

-- Enable pg_trgm extension (safe, idempotent)
create extension if not exists pg_trgm;


-- ---------------------------------------------------------------------------
-- listings — search indexes
-- ---------------------------------------------------------------------------

-- Case-insensitive title search
create index if not exists listings_lower_title_idx
  on public.listings (lower(title));

-- Case-insensitive city / state (used in location filters)
create index if not exists listings_lower_city_idx
  on public.listings (lower(city));

create index if not exists listings_lower_state_idx
  on public.listings (lower(state));

-- GIN trigram index for fast ILIKE search on title
create index if not exists listings_title_trgm_idx
  on public.listings using gin (title gin_trgm_ops);

-- GIN trigram index for ILIKE search on description
create index if not exists listings_description_trgm_idx
  on public.listings using gin (description gin_trgm_ops);

-- Compound index supporting common public query: approved + non-deleted + created_at
create index if not exists listings_approved_created_idx
  on public.listings (status, deleted_at, created_at desc)
  where status = 'approved' and deleted_at is null;

-- Price range filter index
create index if not exists listings_approved_price_idx
  on public.listings (price)
  where status = 'approved' and deleted_at is null;


-- ---------------------------------------------------------------------------
-- creator_profiles — search indexes
-- ---------------------------------------------------------------------------

-- Case-insensitive display_name
create index if not exists creator_profiles_lower_display_name_idx
  on public.creator_profiles (lower(display_name));

-- GIN trigram on display_name for ILIKE search
create index if not exists creator_profiles_display_name_trgm_idx
  on public.creator_profiles using gin (display_name gin_trgm_ops);

-- GIN trigram on bio
create index if not exists creator_profiles_bio_trgm_idx
  on public.creator_profiles using gin (bio gin_trgm_ops);

-- Verified creators filter
create index if not exists creator_profiles_is_verified_idx
  on public.creator_profiles (is_verified)
  where deleted_at is null;

-- Rating sort
create index if not exists creator_profiles_rating_avg_idx
  on public.creator_profiles (rating_avg desc)
  where deleted_at is null;


-- ---------------------------------------------------------------------------
-- categories — search indexes
-- ---------------------------------------------------------------------------

-- is_active + priority for the standard category list query
create index if not exists categories_active_priority_idx
  on public.categories (is_active, priority)
  where is_active = true;

-- Case-insensitive name search
create index if not exists categories_lower_name_idx
  on public.categories (lower(name));

-- Type filter
create index if not exists categories_type_idx
  on public.categories (type)
  where is_active = true;
