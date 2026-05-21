-- =============================================================================
-- Rosovia Module 5: Listings
-- Migration: 003_listings.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.listings
-- ---------------------------------------------------------------------------

create table if not exists public.listings (
  id                     uuid        primary key default gen_random_uuid(),
  creator_id             uuid        not null references public.creator_profiles(id) on delete cascade,
  category_id            uuid        not null references public.categories(id),
  listing_type           text        not null,
  title                  text        not null,
  slug                   text        not null,
  description            text,
  price                  numeric,
  currency               text        not null default 'INR',
  stock                  integer,
  city                   text,
  state                  text,
  custom_order_available boolean     not null default false,
  delivery_available     boolean     not null default false,
  online_available       boolean     not null default false,
  offline_available      boolean     not null default false,
  status                 text        not null default 'draft',
  verification_status    text        not null default 'unverified',
  metadata               jsonb       not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz null,

  constraint listings_slug_unique unique (slug),

  constraint listings_listing_type_check check (
    listing_type in ('product', 'service', 'mentorship', 'workshop', 'event_booking', 'portfolio')
  ),
  constraint listings_status_check check (
    status in ('draft', 'pending_review', 'approved', 'rejected', 'archived', 'suspended')
  ),
  constraint listings_verification_status_check check (
    verification_status in ('unverified', 'pending', 'verified', 'rejected')
  ),
  constraint listings_price_check check (
    price is null or price >= 0
  ),
  constraint listings_stock_check check (
    stock is null or stock >= 0
  )
);

-- Trigger: auto-update updated_at
drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists listings_creator_id_idx    on public.listings(creator_id);
create index if not exists listings_category_id_idx   on public.listings(category_id);
create index if not exists listings_slug_idx           on public.listings(slug);
create index if not exists listings_status_idx         on public.listings(status);
create index if not exists listings_listing_type_idx   on public.listings(listing_type);
create index if not exists listings_price_idx          on public.listings(price);
create index if not exists listings_city_state_idx     on public.listings(city, state);
create index if not exists listings_created_at_idx     on public.listings(created_at);
create index if not exists listings_metadata_gin_idx   on public.listings using gin(metadata);


-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.listings enable row level security;


-- 2a. Public can read approved non-deleted listings
drop policy if exists "listings: public can read approved" on public.listings;
create policy "listings: public can read approved"
  on public.listings
  for select
  using (
    status = 'approved'
    and deleted_at is null
  );


-- 2b. Creator can read their own listings (all statuses, including drafts)
drop policy if exists "listings: creator can read own" on public.listings;
create policy "listings: creator can read own"
  on public.listings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = listings.creator_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 2c. Creator can insert own listing
--     Status restricted to 'draft' on insert.
--     Creator cannot directly create an approved/rejected/suspended listing.
drop policy if exists "listings: creator can insert own" on public.listings;
create policy "listings: creator can insert own"
  on public.listings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_id
        and p.auth_user_id = auth.uid()
        and p.role = 'creator'
        and p.status = 'active'
        and p.deleted_at is null
    )
    and status = 'draft'
    and verification_status in ('unverified', 'pending')
  );


-- 2d. Creator can update own listing
--     Cannot escalate to approved/rejected/suspended via update.
--     Cannot mark verification_status as verified.
--     Cannot transfer listing to another creator (creator_id must remain theirs).
--     Additional enforcement in service layer for these protected fields.
drop policy if exists "listings: creator can update own" on public.listings;
create policy "listings: creator can update own"
  on public.listings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = listings.creator_id
        and p.auth_user_id = auth.uid()
        and p.role = 'creator'
        and p.status = 'active'
        and p.deleted_at is null
    )
  )
  with check (
    -- still own the listing after update (prevent creator_id transfer)
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_id
        and p.auth_user_id = auth.uid()
        and p.role = 'creator'
        and p.status = 'active'
        and p.deleted_at is null
    )
    -- cannot escalate to system-managed statuses
    and status in ('draft', 'pending_review', 'archived')
    -- cannot self-verify
    and verification_status in ('unverified', 'pending')
  );


-- 2e. Admin can read all listings (including drafts, deleted, suspended)
drop policy if exists "listings: admin can read all" on public.listings;
create policy "listings: admin can read all"
  on public.listings
  for select
  to authenticated
  using (public.is_admin());


-- 2f. Admin can update all listings (approve, reject, suspend, etc.)
drop policy if exists "listings: admin can update all" on public.listings;
create policy "listings: admin can update all"
  on public.listings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
