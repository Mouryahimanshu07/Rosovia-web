-- =============================================================================
-- Rosovia Module 10: Orders
-- Migration: 008_orders.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 003_listings.sql,
--             007_custom_orders.sql
-- Purpose: Creates public.orders and public.order_status_history tables,
--          constraints, indexes, and RLS policies for buyers, creators, and
--          admins. Payments are not implemented here (Module 11).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Allowed status values (shared by both tables)
-- ---------------------------------------------------------------------------

-- order_status: draft | requested | accepted | payment_pending | paid |
--               in_progress | shipped | delivered | completed | cancelled |
--               disputed | refunded
--
-- Module 10 application logic uses only:
--   payment_pending, accepted, in_progress, shipped, delivered,
--   completed, cancelled, disputed
-- paid / refunded are reserved for Module 11+.


-- ---------------------------------------------------------------------------
-- 1. Table: public.orders
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id                uuid          primary key default gen_random_uuid(),
  buyer_id          uuid          not null references public.profiles(id) on delete cascade,
  creator_id        uuid          not null references public.creator_profiles(id) on delete cascade,
  listing_id        uuid          null references public.listings(id) on delete set null,
  custom_order_id   uuid          null references public.custom_orders(id) on delete set null,
  amount            numeric       not null,
  platform_fee      numeric       not null default 0,
  seller_amount     numeric       not null,
  currency          text          not null default 'INR',
  order_status      text          not null default 'draft',
  payment_status    text          not null default 'created',
  delivery_status   text          null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz   null,

  -- order_status: full lifecycle — Module 10 only uses subset before payment
  constraint orders_order_status_check check (
    order_status in (
      'draft',
      'requested',
      'accepted',
      'payment_pending',
      'paid',
      'in_progress',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    )
  ),

  -- payment_status: Module 11 will use paid/failed/refunded
  constraint orders_payment_status_check check (
    payment_status in (
      'created',
      'pending',
      'paid',
      'failed',
      'refunded',
      'partially_refunded'
    )
  ),

  -- Financial amounts must be non-negative
  constraint orders_amount_check check (amount >= 0),
  constraint orders_platform_fee_check check (platform_fee >= 0),
  constraint orders_seller_amount_check check (seller_amount >= 0),

  -- Source constraint: exactly one of listing_id or custom_order_id must be set
  constraint orders_source_check check (
    (listing_id is not null and custom_order_id is null)
    or
    (custom_order_id is not null and listing_id is null)
  )
);


-- Partial unique index: one order per accepted custom order
create unique index if not exists orders_custom_order_id_unique_idx
  on public.orders(custom_order_id)
  where custom_order_id is not null;


-- Trigger: auto-update updated_at
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 2. Indexes: public.orders
-- ---------------------------------------------------------------------------

create index if not exists orders_buyer_id_idx
  on public.orders(buyer_id);

create index if not exists orders_creator_id_idx
  on public.orders(creator_id);

create index if not exists orders_listing_id_idx
  on public.orders(listing_id);

create index if not exists orders_custom_order_id_idx
  on public.orders(custom_order_id);

create index if not exists orders_order_status_idx
  on public.orders(order_status);

create index if not exists orders_payment_status_idx
  on public.orders(payment_status);

create index if not exists orders_created_at_idx
  on public.orders(created_at);

-- Compound indexes for common dashboard queries
create index if not exists orders_buyer_status_idx
  on public.orders(buyer_id, order_status);

create index if not exists orders_creator_status_idx
  on public.orders(creator_id, order_status);


-- ---------------------------------------------------------------------------
-- 3. Table: public.order_status_history
-- ---------------------------------------------------------------------------

create table if not exists public.order_status_history (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders(id) on delete cascade,
  old_status  text        null,
  new_status  text        not null,
  -- changed_by is nullable because ON DELETE SET NULL from profiles
  changed_by  uuid        null references public.profiles(id) on delete set null,
  note        text        null,
  created_at  timestamptz not null default now(),

  -- new_status must be a valid order status
  constraint order_status_history_new_status_check check (
    new_status in (
      'draft',
      'requested',
      'accepted',
      'payment_pending',
      'paid',
      'in_progress',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    )
  ),

  -- old_status must be null or a valid order status
  constraint order_status_history_old_status_check check (
    old_status is null
    or old_status in (
      'draft',
      'requested',
      'accepted',
      'payment_pending',
      'paid',
      'in_progress',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    )
  ),

  -- note max 1000 characters
  constraint order_status_history_note_length_check check (
    note is null or char_length(note) <= 1000
  )
);


-- ---------------------------------------------------------------------------
-- 4. Indexes: public.order_status_history
-- ---------------------------------------------------------------------------

create index if not exists order_status_history_order_id_idx
  on public.order_status_history(order_id);

create index if not exists order_status_history_changed_by_idx
  on public.order_status_history(changed_by);

create index if not exists order_status_history_created_at_idx
  on public.order_status_history(created_at);


-- ---------------------------------------------------------------------------
-- 5. Row Level Security: public.orders
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;


-- ---------------------------------------------------------------------------
-- 5a. Buyer can read own orders (non-deleted)
-- ---------------------------------------------------------------------------
drop policy if exists "orders: buyer can read own" on public.orders;
create policy "orders: buyer can read own"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 5b. Buyer can create listing order
--     Service layer enforces: listing is approved, creator is active,
--     amount derived from listing.price. RLS enforces buyer identity and
--     initial status values only.
-- ---------------------------------------------------------------------------
drop policy if exists "orders: buyer can create listing order" on public.orders;
create policy "orders: buyer can create listing order"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and listing_id is not null
    and custom_order_id is null
    and order_status in ('payment_pending', 'requested')
    and payment_status in ('created', 'pending')
  );


-- ---------------------------------------------------------------------------
-- 5c. Buyer can create order from accepted custom order
--     Service layer enforces: custom order belongs to buyer, status = accepted,
--     no duplicate order, amount derived from creator_quote_amount.
-- ---------------------------------------------------------------------------
drop policy if exists "orders: buyer can create custom order" on public.orders;
create policy "orders: buyer can create custom order"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and custom_order_id is not null
    and listing_id is null
    and order_status = 'payment_pending'
    and payment_status in ('created', 'pending')
  );


-- ---------------------------------------------------------------------------
-- 5d. Buyer can cancel own order before payment (payment_status = created/pending)
--     Buyer cannot set paid, in_progress, shipped, delivered, completed, refunded.
-- ---------------------------------------------------------------------------
drop policy if exists "orders: buyer can cancel own order" on public.orders;
create policy "orders: buyer can cancel own order"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and orders.payment_status in ('created', 'pending')
    and orders.order_status not in ('paid', 'in_progress', 'shipped', 'delivered', 'completed', 'refunded')
    and orders.deleted_at is null
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and order_status in ('cancelled', 'completed', 'disputed')
    and payment_status in ('created', 'pending')
  );


-- ---------------------------------------------------------------------------
-- 5e. Creator can read assigned orders (active creator only, non-deleted)
-- ---------------------------------------------------------------------------
drop policy if exists "orders: creator can read assigned" on public.orders;
create policy "orders: creator can read assigned"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 5f. Creator can update fulfillment status for assigned orders
--     Allowed new statuses: accepted, in_progress, shipped, delivered,
--                           cancelled, disputed
--     Creator cannot set: paid, refunded, completed (buyer only), payment_status = paid
-- ---------------------------------------------------------------------------
drop policy if exists "orders: creator can update fulfillment" on public.orders;
create policy "orders: creator can update fulfillment"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and orders.order_status not in ('paid', 'completed', 'refunded', 'cancelled')
    and orders.deleted_at is null
  )
  with check (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and order_status in ('accepted', 'in_progress', 'shipped', 'delivered', 'cancelled', 'disputed')
    and payment_status not in ('paid', 'refunded', 'partially_refunded')
  );


-- ---------------------------------------------------------------------------
-- 5g. Admin can read all orders
-- ---------------------------------------------------------------------------
drop policy if exists "orders: admin can read all" on public.orders;
create policy "orders: admin can read all"
  on public.orders
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5h. Admin can update all orders
-- ---------------------------------------------------------------------------
drop policy if exists "orders: admin can update all" on public.orders;
create policy "orders: admin can update all"
  on public.orders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 6. Row Level Security: public.order_status_history
-- ---------------------------------------------------------------------------

alter table public.order_status_history enable row level security;


-- ---------------------------------------------------------------------------
-- 6a. Buyer can read history for own orders
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history: buyer can read own" on public.order_status_history;
create policy "order_status_history: buyer can read own"
  on public.order_status_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.profiles p on p.id = o.buyer_id
      where o.id = order_status_history.order_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
        and o.deleted_at is null
    )
  );


-- ---------------------------------------------------------------------------
-- 6b. Creator can read history for assigned orders
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history: creator can read assigned" on public.order_status_history;
create policy "order_status_history: creator can read assigned"
  on public.order_status_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.creator_profiles cp on cp.id = o.creator_id
      join public.profiles p on p.id = cp.user_id
      where o.id = order_status_history.order_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
        and cp.deleted_at is null
        and o.deleted_at is null
    )
  );


-- ---------------------------------------------------------------------------
-- 6c. Authenticated user can insert history for own orders
--     changed_by must be the current user's profile id.
--     Order must belong to current user as buyer or creator.
--     Service layer is the primary enforcement point.
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history: user can insert for own order" on public.order_status_history;
create policy "order_status_history: user can insert for own order"
  on public.order_status_history
  for insert
  to authenticated
  with check (
    -- changed_by must be the current user's profile
    exists (
      select 1 from public.profiles p
      where p.id = order_status_history.changed_by
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and
    -- order must belong to current user as buyer or creator
    (
      exists (
        select 1
        from public.orders o
        join public.profiles p on p.id = o.buyer_id
        where o.id = order_status_history.order_id
          and p.auth_user_id = auth.uid()
          and o.deleted_at is null
      )
      or
      exists (
        select 1
        from public.orders o
        join public.creator_profiles cp on cp.id = o.creator_id
        join public.profiles p on p.id = cp.user_id
        where o.id = order_status_history.order_id
          and p.auth_user_id = auth.uid()
          and o.deleted_at is null
      )
    )
  );


-- ---------------------------------------------------------------------------
-- 6d. Admin can read all history
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history: admin can read all" on public.order_status_history;
create policy "order_status_history: admin can read all"
  on public.order_status_history
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 6e. Admin can insert/update history
-- ---------------------------------------------------------------------------
drop policy if exists "order_status_history: admin can insert" on public.order_status_history;
create policy "order_status_history: admin can insert"
  on public.order_status_history
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "order_status_history: admin can update" on public.order_status_history;
create policy "order_status_history: admin can update"
  on public.order_status_history
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
