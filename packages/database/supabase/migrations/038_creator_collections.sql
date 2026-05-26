-- Migration: 038_creator_collections.sql
-- Description: Create creator_collections and collection_items tables with cascade deletes, unique constraints, performance indexes, and fine-grained Row-Level Security (RLS) policies.

-- 1. Table: public.creator_collections
create table if not exists public.creator_collections (
  id           uuid        primary key default gen_random_uuid(),
  creator_id   uuid        not null references public.creator_profiles(id) on delete cascade,
  name         text        not null,
  slug         text        not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz null,

  constraint creator_collections_creator_slug_unique unique (creator_id, slug)
);

-- Trigger: auto-update updated_at for creator_collections
drop trigger if exists set_creator_collections_updated_at on public.creator_collections;
create trigger set_creator_collections_updated_at
  before update on public.creator_collections
  for each row execute function public.set_updated_at();

-- 2. Table: public.collection_items
create table if not exists public.collection_items (
  id            uuid        primary key default gen_random_uuid(),
  collection_id uuid        not null references public.creator_collections(id) on delete cascade,
  listing_id    uuid        not null references public.listings(id) on delete cascade,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),

  constraint collection_items_collection_listing_unique unique (collection_id, listing_id)
);

-- Indexes for performance
create index if not exists creator_collections_creator_id_idx on public.creator_collections(creator_id);
create index if not exists creator_collections_slug_idx on public.creator_collections(slug);
create index if not exists collection_items_collection_id_idx on public.collection_items(collection_id);
create index if not exists collection_items_listing_id_idx on public.collection_items(listing_id);

-- Enable RLS
alter table public.creator_collections enable row level security;
alter table public.collection_items enable row level security;

-- 3. Row Level Security Policies

-- Policy 3a: public can read active creator collections
drop policy if exists "creator_collections: public can read active" on public.creator_collections;
create policy "creator_collections: public can read active"
  on public.creator_collections
  for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on cp.user_id = p.id
      where cp.id = creator_id
        and cp.deleted_at is null
        and p.deleted_at is null
        and p.status = 'active'
    )
  );

-- Policy 3b: creator can manage their own collections (SELECT, INSERT, UPDATE, DELETE)
drop policy if exists "creator_collections: creator can manage own" on public.creator_collections;
create policy "creator_collections: creator can manage own"
  on public.creator_collections
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.creator_profiles cp on cp.user_id = p.id
      where cp.id = creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      join public.creator_profiles cp on cp.user_id = p.id
      where cp.id = creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

-- Policy 3c: public can read collection items
drop policy if exists "collection_items: public can read" on public.collection_items;
create policy "collection_items: public can read"
  on public.collection_items
  for select
  using (
    exists (
      select 1 from public.creator_collections cc
      where cc.id = collection_id
        and cc.deleted_at is null
    )
  );

-- Policy 3d: creator can manage their own collection items
drop policy if exists "collection_items: creator can manage own" on public.collection_items;
create policy "collection_items: creator can manage own"
  on public.collection_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.creator_collections cc
      join public.creator_profiles cp on cc.creator_id = cp.id
      join public.profiles p on cp.user_id = p.id
      where cc.id = collection_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.creator_collections cc
      join public.creator_profiles cp on cc.creator_id = cp.id
      join public.profiles p on cp.user_id = p.id
      where cc.id = collection_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );
