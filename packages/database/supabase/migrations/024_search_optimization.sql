-- =============================================================================
-- Rosovia Step 15: Search Optimization
-- Migration: 024_search_optimization.sql
-- Depends on: 005_explore_search_indexes.sql, 003_listings.sql, 002_creator_profiles.sql
-- Purpose: Add additional composite indexes for listing filter queries and
--          ensure pg_trgm is enabled. Fully additive — no schema changes.
-- =============================================================================

-- Ensure pg_trgm is available (idempotent)
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- listings — composite filter indexes
-- ---------------------------------------------------------------------------

-- category_id + status + created_at (category detail page, category filter)
create index if not exists listings_category_status_created_idx
  on public.listings (category_id, status, created_at desc)
  where deleted_at is null;

-- status + price for price-sorted approved public queries
create index if not exists listings_status_price_created_idx
  on public.listings (status, price asc, created_at desc)
  where status = 'approved' and deleted_at is null;

-- creator_id + status for creator-specific listing lookups
create index if not exists listings_creator_status_idx
  on public.listings (creator_id, status)
  where deleted_at is null;

-- listing_type + status for type-filter queries
create index if not exists listings_type_status_idx
  on public.listings (listing_type, status)
  where status = 'approved' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- creator_profiles — composite filter indexes
-- ---------------------------------------------------------------------------

-- primary_category_id + is_verified for category page creator sidebar
create index if not exists creator_profiles_category_verified_idx
  on public.creator_profiles (primary_category_id, is_verified desc, rating_avg desc)
  where deleted_at is null;

-- city + state for location-based creator filtering
create index if not exists creator_profiles_city_state_idx
  on public.creator_profiles (lower(city), lower(state))
  where deleted_at is null;
