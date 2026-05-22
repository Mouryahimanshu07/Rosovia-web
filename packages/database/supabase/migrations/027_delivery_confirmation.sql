-- =============================================================================
-- Rosovia Module: Delivery Confirmation
-- Migration: 027_delivery_confirmation.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 008_orders.sql
-- Purpose: Creates public.order_deliveries table for order fulfillment and tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.order_deliveries
-- ---------------------------------------------------------------------------

create table if not exists public.order_deliveries (
  id                    uuid        primary key default gen_random_uuid(),
  order_id              uuid        not null references public.orders(id) on delete cascade unique,
  creator_id            uuid        not null references public.creator_profiles(id) on delete cascade,
  buyer_id              uuid        not null references public.profiles(id) on delete cascade,
  delivery_type         text        not null default 'manual',
  tracking_reference    text        null,
  delivery_note         text        null,
  shipped_at            timestamptz null,
  delivered_at          timestamptz null,
  buyer_confirmed_at    timestamptz null,
  status                text        not null default 'pending',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz null,

  -- status check constraint
  constraint order_deliveries_status_check check (
    status in ('pending', 'shipped', 'delivered', 'buyer_confirmed', 'disputed', 'cancelled')
  ),

  -- delivery_type check constraint
  constraint order_deliveries_delivery_type_check check (
    delivery_type in ('manual', 'courier', 'digital')
  ),

  -- note and reference lengths
  constraint order_deliveries_note_length_check check (
    delivery_note is null or char_length(delivery_note) <= 2000
  ),
  constraint order_deliveries_tracking_ref_length_check check (
    tracking_reference is null or char_length(tracking_reference) <= 200
  )
);

-- Trigger: auto-update updated_at for order_deliveries
drop trigger if exists set_order_deliveries_updated_at on public.order_deliveries;
create trigger set_order_deliveries_updated_at
  before update on public.order_deliveries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

create index if not exists order_deliveries_order_id_idx on public.order_deliveries(order_id);
create index if not exists order_deliveries_creator_id_idx on public.order_deliveries(creator_id);
create index if not exists order_deliveries_buyer_id_idx on public.order_deliveries(buyer_id);
create index if not exists order_deliveries_status_idx on public.order_deliveries(status);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.order_deliveries enable row level security;

-- 3a. Buyer can SELECT own order_deliveries
drop policy if exists "order_deliveries: buyer can select own" on public.order_deliveries;
create policy "order_deliveries: buyer can select own"
  on public.order_deliveries
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = order_deliveries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- 3b. Assigned creator can SELECT own order_deliveries
drop policy if exists "order_deliveries: creator can select assigned" on public.order_deliveries;
create policy "order_deliveries: creator can select assigned"
  on public.order_deliveries
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = order_deliveries.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- 3c. Creator can INSERT order_deliveries for their assigned orders
drop policy if exists "order_deliveries: creator can insert" on public.order_deliveries;
create policy "order_deliveries: creator can insert"
  on public.order_deliveries
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = order_deliveries.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- 3d. Creator can UPDATE progress on their assigned deliveries
drop policy if exists "order_deliveries: creator can update progress" on public.order_deliveries;
create policy "order_deliveries: creator can update progress"
  on public.order_deliveries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = order_deliveries.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = order_deliveries.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- 3e. Buyer can UPDATE (confirm) own deliveries
drop policy if exists "order_deliveries: buyer can confirm delivery" on public.order_deliveries;
create policy "order_deliveries: buyer can confirm delivery"
  on public.order_deliveries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = order_deliveries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = order_deliveries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- 3f. Admin can SELECT all order_deliveries
drop policy if exists "order_deliveries: admin can select all" on public.order_deliveries;
create policy "order_deliveries: admin can select all"
  on public.order_deliveries
  for select
  to authenticated
  using (public.is_admin());

-- 3g. Admin can UPDATE all order_deliveries
drop policy if exists "order_deliveries: admin can update all" on public.order_deliveries;
create policy "order_deliveries: admin can update all"
  on public.order_deliveries
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Trigger to sync order_status with order_deliveries
-- ---------------------------------------------------------------------------

create or replace function public.sync_order_delivery_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_status text;
  v_shipped_at timestamptz := null;
  v_delivered_at timestamptz := null;
  v_buyer_confirmed_at timestamptz := null;
begin
  -- Map order_status to order_deliveries.status
  case new.order_status
    when 'shipped' then
      v_delivery_status := 'shipped';
      v_shipped_at := now();
    when 'delivered' then
      v_delivery_status := 'delivered';
      v_delivered_at := now();
    when 'completed' then
      v_delivery_status := 'buyer_confirmed';
      v_buyer_confirmed_at := now();
    when 'disputed' then
      v_delivery_status := 'disputed';
    when 'cancelled' then
      v_delivery_status := 'cancelled';
    else
      -- For draft, requested, accepted, payment_pending, paid, in_progress
      v_delivery_status := 'pending';
  end case;

  -- Only act if the status is one of the delivery-relevant ones
  -- or if a delivery record already exists and needs updating
  if v_delivery_status in ('shipped', 'delivered', 'buyer_confirmed', 'disputed', 'cancelled')
     or exists (select 1 from public.order_deliveries where order_id = new.id) then
     
    insert into public.order_deliveries (
      order_id,
      creator_id,
      buyer_id,
      status,
      shipped_at,
      delivered_at,
      buyer_confirmed_at
    )
    values (
      new.id,
      new.creator_id,
      new.buyer_id,
      v_delivery_status,
      v_shipped_at,
      v_delivered_at,
      v_buyer_confirmed_at
    )
    on conflict (order_id) do update
    set
      status = excluded.status,
      shipped_at = coalesce(order_deliveries.shipped_at, excluded.shipped_at),
      delivered_at = coalesce(order_deliveries.delivered_at, excluded.delivered_at),
      buyer_confirmed_at = coalesce(order_deliveries.buyer_confirmed_at, excluded.buyer_confirmed_at),
      updated_at = now();
  end if;

  return new;
end;
$$;

-- Trigger: auto-sync order status to order_deliveries
drop trigger if exists on_order_status_change_sync_delivery on public.orders;
create trigger on_order_status_change_sync_delivery
  after update of order_status on public.orders
  for each row
  execute function public.sync_order_delivery_on_status_change();
