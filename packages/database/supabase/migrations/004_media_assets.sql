-- =============================================================================
-- Rosovia Module 6: Media Upload
-- Migration: 004_media_assets.sql
-- Depends on: 001_foundation.sql, 002_creator_profiles.sql, 003_listings.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.media_assets
-- ---------------------------------------------------------------------------

create table if not exists public.media_assets (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null references public.profiles(id) on delete cascade,
  listing_id       uuid        null references public.listings(id) on delete set null,
  media_type       text        not null,
  storage_provider text        not null default 'cloudflare_r2',
  storage_key      text        not null,
  public_url       text        null,
  thumbnail_url    text        null,
  size_bytes       bigint      not null,
  mime_type        text        not null,
  duration_seconds integer     null,
  is_private       boolean     not null default false,
  status           text        not null default 'uploaded',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz null,

  constraint media_assets_storage_key_unique unique (storage_key),

  constraint media_assets_media_type_check check (
    media_type in ('image', 'video', 'document')
  ),
  constraint media_assets_storage_provider_check check (
    storage_provider in ('cloudflare_r2')
  ),
  constraint media_assets_status_check check (
    status in ('uploaded', 'processing', 'ready', 'failed', 'deleted')
  ),
  constraint media_assets_size_bytes_check check (
    size_bytes > 0
  ),
  constraint media_assets_duration_check check (
    duration_seconds is null or duration_seconds >= 0
  )
);


-- Trigger: auto-update updated_at
drop trigger if exists set_media_assets_updated_at on public.media_assets;
create trigger set_media_assets_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();


-- Indexes
create index if not exists media_assets_owner_id_idx     on public.media_assets(owner_id);
create index if not exists media_assets_listing_id_idx   on public.media_assets(listing_id);
create index if not exists media_assets_media_type_idx   on public.media_assets(media_type);
create index if not exists media_assets_status_idx       on public.media_assets(status);
create index if not exists media_assets_is_private_idx   on public.media_assets(is_private);
create index if not exists media_assets_created_at_idx   on public.media_assets(created_at);
create index if not exists media_assets_storage_key_idx  on public.media_assets(storage_key);


-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.media_assets enable row level security;


-- 2a. Public can read non-private, uploaded/ready media (not deleted)
drop policy if exists "media_assets: public can read public ready" on public.media_assets;
create policy "media_assets: public can read public ready"
  on public.media_assets
  for select
  using (
    is_private = false
    and status in ('uploaded', 'ready')
    and deleted_at is null
  );


-- 2b. Owner can read their own media (all statuses including private)
drop policy if exists "media_assets: owner can read own" on public.media_assets;
create policy "media_assets: owner can read own"
  on public.media_assets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = media_assets.owner_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 2c. Owner can insert their own media metadata
--     owner_id must belong to authenticated user.
--     status restricted to uploaded or processing on insert.
--     public_url must be null for private media (enforced in service layer).
drop policy if exists "media_assets: owner can insert own" on public.media_assets;
create policy "media_assets: owner can insert own"
  on public.media_assets
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = owner_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and status in ('uploaded', 'processing')
  );


-- 2d. Owner can update their own media metadata
--     Cannot transfer to another owner_id.
--     Cannot escalate status to arbitrary values via update.
drop policy if exists "media_assets: owner can update own" on public.media_assets;
create policy "media_assets: owner can update own"
  on public.media_assets
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = media_assets.owner_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    -- must still own after update (no ownership transfer)
    exists (
      select 1 from public.profiles p
      where p.id = owner_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 2e. Admin can read all media
drop policy if exists "media_assets: admin can read all" on public.media_assets;
create policy "media_assets: admin can read all"
  on public.media_assets
  for select
  to authenticated
  using (public.is_admin());


-- 2f. Admin can update all media
drop policy if exists "media_assets: admin can update all" on public.media_assets;
create policy "media_assets: admin can update all"
  on public.media_assets
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
