-- Migration: 037_saved_items.sql
-- Description: Create saved_listings and saved_creators tables with RLS and indexes.

-- 1. Table: public.saved_listings
create table if not exists public.saved_listings (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  listing_id   uuid        not null references public.listings(id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint saved_listings_user_listing_unique unique (user_id, listing_id)
);

-- 2. Table: public.saved_creators
create table if not exists public.saved_creators (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references public.profiles(id) on delete cascade,
  creator_profile_id uuid        not null references public.creator_profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),

  constraint saved_creators_user_creator_unique unique (user_id, creator_profile_id)
);

-- Indexes for performance
create index if not exists saved_listings_user_id_idx on public.saved_listings(user_id);
create index if not exists saved_listings_listing_id_idx on public.saved_listings(listing_id);

create index if not exists saved_creators_user_id_idx on public.saved_creators(user_id);
create index if not exists saved_creators_creator_profile_id_idx on public.saved_creators(creator_profile_id);

-- Enable RLS
alter table public.saved_listings enable row level security;
alter table public.saved_creators enable row level security;

-- 3. Row Level Security Policies
drop policy if exists "saved_listings: users can manage own" on public.saved_listings;
create policy "saved_listings: users can manage own"
  on public.saved_listings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "saved_creators: users can manage own" on public.saved_creators;
create policy "saved_creators: users can manage own"
  on public.saved_creators
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.auth_user_id = auth.uid()
    )
  );
