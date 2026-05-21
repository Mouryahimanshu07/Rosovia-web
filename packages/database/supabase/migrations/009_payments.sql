-- =============================================================================
-- Rosovia Module 11: Payments
-- Migration: 009_payments.sql
-- Depends on: 008_orders.sql
-- Purpose: Creates public.payments table for tracking Razorpay payment records.
--          Connects payment provider lifecycle to existing public.orders.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.payments
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id                      uuid          primary key default gen_random_uuid(),
  order_id                uuid          not null references public.orders(id) on delete cascade,
  provider                text          not null default 'razorpay',
  provider_payment_id     text          null,
  provider_order_id       text          null,
  provider_payment_link_id text         null,
  amount                  numeric       not null,
  currency                text          not null default 'INR',
  status                  text          not null default 'created',
  webhook_received        boolean       not null default false,
  webhook_event_id        text          unique null,
  raw_payload             jsonb         null,
  created_at              timestamptz   not null default now(),
  updated_at              timestamptz   not null default now(),
  deleted_at              timestamptz   null,

  -- Only Razorpay in Module 11
  constraint payments_provider_check check (
    provider in ('razorpay')
  ),

  -- Payment lifecycle statuses
  -- Module 11 uses: created, pending, paid, failed
  -- refunded/partially_refunded/cancelled are future-compatible
  constraint payments_status_check check (
    status in (
      'created',
      'pending',
      'paid',
      'failed',
      'refunded',
      'partially_refunded',
      'cancelled'
    )
  ),

  -- Amount must be non-negative
  constraint payments_amount_check check (amount >= 0)
);


-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists payments_order_id_idx
  on public.payments(order_id);

create index if not exists payments_provider_order_id_idx
  on public.payments(provider_order_id);

create index if not exists payments_provider_payment_id_idx
  on public.payments(provider_payment_id);

create index if not exists payments_status_idx
  on public.payments(status);

create index if not exists payments_webhook_event_id_idx
  on public.payments(webhook_event_id);

create index if not exists payments_created_at_idx
  on public.payments(created_at);


-- Partial unique indexes: one active Razorpay order per payment row
create unique index if not exists payments_provider_order_id_unique_idx
  on public.payments(provider_order_id)
  where provider_order_id is not null;

create unique index if not exists payments_provider_payment_id_unique_idx
  on public.payments(provider_payment_id)
  where provider_payment_id is not null;


-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.payments enable row level security;


-- ---------------------------------------------------------------------------
-- 4a. Buyer can read payments for own orders
-- ---------------------------------------------------------------------------
drop policy if exists "payments: buyer can read own" on public.payments;
create policy "payments: buyer can read own"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.profiles p on p.id = o.buyer_id
      where o.id = payments.order_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
        and o.deleted_at is null
    )
    and payments.deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 4b. Creator can read payments for assigned orders
-- ---------------------------------------------------------------------------
drop policy if exists "payments: creator can read assigned" on public.payments;
create policy "payments: creator can read assigned"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.creator_profiles cp on cp.id = o.creator_id
      join public.profiles p on p.id = cp.user_id
      where o.id = payments.order_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
        and cp.deleted_at is null
        and o.deleted_at is null
    )
    and payments.deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 4c. Buyer can insert initial payment record (status created/pending only)
--     Service layer enforces amount, currency, provider correctness.
--     This is a narrow policy: buyer must own the order.
-- ---------------------------------------------------------------------------
drop policy if exists "payments: buyer can create payment" on public.payments;
create policy "payments: buyer can create payment"
  on public.payments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      join public.profiles p on p.id = o.buyer_id
      where o.id = payments.order_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and o.deleted_at is null
    )
    and payments.status in ('created', 'pending')
    and payments.provider = 'razorpay'
  );


-- ---------------------------------------------------------------------------
-- 4d. Admin can read all payments
-- ---------------------------------------------------------------------------
drop policy if exists "payments: admin can read all" on public.payments;
create policy "payments: admin can read all"
  on public.payments
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4e. Admin can update all payments
-- ---------------------------------------------------------------------------
drop policy if exists "payments: admin can update all" on public.payments;
create policy "payments: admin can update all"
  on public.payments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- NOTE: Webhook payment updates (setting paid/failed) are performed by the
-- server-side webhook route using the service-role Supabase client.
-- No RLS policy is required for service-role operations.
-- Normal users cannot set payment_status = paid via RLS — they have no UPDATE
-- policy on this table.
