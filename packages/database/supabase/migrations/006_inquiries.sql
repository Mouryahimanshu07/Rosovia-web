-- =============================================================================
-- Rosovia Module 8: Inquiry System
-- Migration: 006_inquiries.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 003_listings.sql
-- Purpose: Creates the public.inquiries table, RLS policies, and indexes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.inquiries
-- ---------------------------------------------------------------------------

create table if not exists public.inquiries (
  id                uuid        primary key default gen_random_uuid(),
  buyer_id          uuid        not null references public.profiles(id) on delete cascade,
  creator_id        uuid        not null references public.creator_profiles(id) on delete cascade,
  listing_id        uuid        null references public.listings(id) on delete set null,
  inquiry_type      text        not null,
  message           text        not null,
  creator_response  text        null,
  status            text        not null default 'open',
  replied_at        timestamptz null,
  closed_at         timestamptz null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz null,

  constraint inquiries_inquiry_type_check check (
    inquiry_type in ('general', 'product', 'service', 'mentorship', 'custom_order')
  ),
  constraint inquiries_status_check check (
    status in ('open', 'replied', 'closed', 'spam')
  ),
  constraint inquiries_message_length_check check (
    char_length(message) >= 1 and char_length(message) <= 2000
  ),
  constraint inquiries_creator_response_length_check check (
    creator_response is null or char_length(creator_response) <= 2000
  )
);


-- Trigger: auto-update updated_at
drop trigger if exists set_inquiries_updated_at on public.inquiries;
create trigger set_inquiries_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

create index if not exists inquiries_buyer_id_idx
  on public.inquiries(buyer_id);

create index if not exists inquiries_creator_id_idx
  on public.inquiries(creator_id);

create index if not exists inquiries_listing_id_idx
  on public.inquiries(listing_id);

create index if not exists inquiries_status_idx
  on public.inquiries(status);

create index if not exists inquiries_created_at_idx
  on public.inquiries(created_at);

-- Compound indexes for common dashboard queries
create index if not exists inquiries_creator_status_idx
  on public.inquiries(creator_id, status);

create index if not exists inquiries_buyer_status_idx
  on public.inquiries(buyer_id, status);


-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.inquiries enable row level security;


-- ---------------------------------------------------------------------------
-- 3a. Buyer can read own inquiries (non-deleted)
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: buyer can read own" on public.inquiries;
create policy "inquiries: buyer can read own"
  on public.inquiries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = inquiries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 3b. Buyer can create own inquiry
--     buyer_id must be the current user's profile.
--     status must be open, creator_response/replied_at/closed_at must be null.
--     Buyer profile must be active.
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: buyer can create own" on public.inquiries;
create policy "inquiries: buyer can create own"
  on public.inquiries
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = inquiries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and status = 'open'
    and creator_response is null
    and replied_at is null
    and closed_at is null
  );


-- ---------------------------------------------------------------------------
-- 3c. Buyer can close own inquiry (open/replied -> closed only)
--     Buyer cannot edit creator_response, creator_id, listing_id, buyer_id.
--     Note: Field-level restrictions are enforced in the service layer.
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: buyer can close own" on public.inquiries;
create policy "inquiries: buyer can close own"
  on public.inquiries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = inquiries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and inquiries.status in ('open', 'replied')
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = inquiries.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and status = 'closed'
  );


-- ---------------------------------------------------------------------------
-- 3d. Creator can read assigned inquiries (non-deleted, active creator)
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: creator can read assigned" on public.inquiries;
create policy "inquiries: creator can read assigned"
  on public.inquiries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = inquiries.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 3e. Creator can update assigned inquiries
--     Can set creator_response, status (replied/closed/spam), replied_at, closed_at.
--     Cannot change buyer_id, creator_id, listing_id, or original message.
--     Note: Field immutability enforced in service layer for full protection.
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: creator can update assigned" on public.inquiries;
create policy "inquiries: creator can update assigned"
  on public.inquiries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = inquiries.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = inquiries.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and status in ('replied', 'closed', 'spam')
  );


-- ---------------------------------------------------------------------------
-- 3f. Admin can read all inquiries
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: admin can read all" on public.inquiries;
create policy "inquiries: admin can read all"
  on public.inquiries
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3g. Admin can update all inquiries
-- ---------------------------------------------------------------------------
drop policy if exists "inquiries: admin can update all" on public.inquiries;
create policy "inquiries: admin can update all"
  on public.inquiries
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
