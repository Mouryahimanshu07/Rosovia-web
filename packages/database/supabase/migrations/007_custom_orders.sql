-- =============================================================================
-- Rosovia Module 9: Custom Orders
-- Migration: 007_custom_orders.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 003_listings.sql,
--             004_media_assets.sql
-- Purpose: Creates the public.custom_orders table, constraints, indexes, and
--          RLS policies for buyers, creators, and admins.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.custom_orders
-- ---------------------------------------------------------------------------

create table if not exists public.custom_orders (
  id                    uuid          primary key default gen_random_uuid(),
  buyer_id              uuid          not null references public.profiles(id) on delete cascade,
  creator_id            uuid          not null references public.creator_profiles(id) on delete cascade,
  listing_id            uuid          null references public.listings(id) on delete set null,
  category_id           uuid          not null references public.categories(id),
  title                 text          not null,
  description           text          not null,
  reference_media_id    uuid          null references public.media_assets(id) on delete set null,
  budget_min            numeric       null,
  budget_max            numeric       null,
  deadline              date          null,
  delivery_city         text          null,
  delivery_state        text          null,
  creator_quote_amount  numeric       null,
  creator_quote_note    text          null,
  status                text          not null default 'requested',
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),
  deleted_at            timestamptz   null,

  -- Status: all possible lifecycle values for future module compatibility
  constraint custom_orders_status_check check (
    status in (
      'requested',
      'creator_reviewing',
      'quoted',
      'accepted',
      'rejected',
      'payment_pending',
      'paid',
      'in_progress',
      'delivered',
      'completed',
      'cancelled',
      'disputed'
    )
  ),

  -- Title: 3-160 chars
  constraint custom_orders_title_length_check check (
    char_length(title) between 3 and 160
  ),

  -- Description: 20-4000 chars
  constraint custom_orders_description_length_check check (
    char_length(description) between 20 and 4000
  ),

  -- Budget: individual values must be non-negative if provided
  constraint custom_orders_budget_min_check check (
    budget_min is null or budget_min >= 0
  ),
  constraint custom_orders_budget_max_check check (
    budget_max is null or budget_max >= 0
  ),

  -- Budget range: max must not be less than min when both are set
  constraint custom_orders_budget_range_check check (
    budget_min is null or budget_max is null or budget_max >= budget_min
  ),

  -- Quote amount must be non-negative if provided
  constraint custom_orders_quote_amount_check check (
    creator_quote_amount is null or creator_quote_amount >= 0
  ),

  -- Quote note max length
  constraint custom_orders_quote_note_length_check check (
    creator_quote_note is null or char_length(creator_quote_note) <= 2000
  ),

  -- Delivery city/state length
  constraint custom_orders_delivery_city_length_check check (
    delivery_city is null or char_length(delivery_city) <= 80
  ),
  constraint custom_orders_delivery_state_length_check check (
    delivery_state is null or char_length(delivery_state) <= 80
  )
);


-- Trigger: auto-update updated_at
drop trigger if exists set_custom_orders_updated_at on public.custom_orders;
create trigger set_custom_orders_updated_at
  before update on public.custom_orders
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

create index if not exists custom_orders_buyer_id_idx
  on public.custom_orders(buyer_id);

create index if not exists custom_orders_creator_id_idx
  on public.custom_orders(creator_id);

create index if not exists custom_orders_listing_id_idx
  on public.custom_orders(listing_id);

create index if not exists custom_orders_category_id_idx
  on public.custom_orders(category_id);

create index if not exists custom_orders_status_idx
  on public.custom_orders(status);

create index if not exists custom_orders_created_at_idx
  on public.custom_orders(created_at);

-- Compound indexes for common dashboard queries
create index if not exists custom_orders_buyer_status_idx
  on public.custom_orders(buyer_id, status);

create index if not exists custom_orders_creator_status_idx
  on public.custom_orders(creator_id, status);


-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.custom_orders enable row level security;


-- ---------------------------------------------------------------------------
-- 3a. Buyer can read own custom orders (non-deleted)
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: buyer can read own" on public.custom_orders;
create policy "custom_orders: buyer can read own"
  on public.custom_orders
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = custom_orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 3b. Buyer can create own custom order
--     - buyer_id must be the calling user's profile
--     - buyer profile must be active
--     - status must be 'requested'
--     - creator quote fields must be null on insert
--     - target creator must exist (RLS cannot verify creator activity here;
--       that is enforced in the service layer)
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: buyer can create own" on public.custom_orders;
create policy "custom_orders: buyer can create own"
  on public.custom_orders
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = custom_orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and status = 'requested'
    and creator_quote_amount is null
    and creator_quote_note is null
  );


-- ---------------------------------------------------------------------------
-- 3c. Buyer can update own custom order (limited operations)
--     Allowed transitions:
--       - quoted -> accepted   (accept quote)
--       - requested/creator_reviewing/quoted -> cancelled  (cancel)
--     Field-level protection (buyer cannot change immutable fields) is
--     enforced in the service layer.
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: buyer can update own" on public.custom_orders;
create policy "custom_orders: buyer can update own"
  on public.custom_orders
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = custom_orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and custom_orders.status in ('requested', 'creator_reviewing', 'quoted')
    and custom_orders.deleted_at is null
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = custom_orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and status in ('accepted', 'cancelled')
  );


-- ---------------------------------------------------------------------------
-- 3d. Creator can read assigned custom orders (non-deleted, active creator)
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: creator can read assigned" on public.custom_orders;
create policy "custom_orders: creator can read assigned"
  on public.custom_orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = custom_orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 3e. Creator can update assigned custom orders (limited operations)
--     Allowed new statuses: creator_reviewing, quoted, rejected, cancelled
--     Field-level protection (creator cannot change buyer fields, listing,
--     category, title, description, reference_media_id, or budget fields)
--     is enforced in the service layer.
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: creator can update assigned" on public.custom_orders;
create policy "custom_orders: creator can update assigned"
  on public.custom_orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = custom_orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and custom_orders.status in ('requested', 'creator_reviewing', 'quoted')
    and custom_orders.deleted_at is null
  )
  with check (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = custom_orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and status in ('creator_reviewing', 'quoted', 'rejected', 'cancelled')
  );


-- ---------------------------------------------------------------------------
-- 3f. Admin can read all custom orders
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: admin can read all" on public.custom_orders;
create policy "custom_orders: admin can read all"
  on public.custom_orders
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3g. Admin can update all custom orders
-- ---------------------------------------------------------------------------
drop policy if exists "custom_orders: admin can update all" on public.custom_orders;
create policy "custom_orders: admin can update all"
  on public.custom_orders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
