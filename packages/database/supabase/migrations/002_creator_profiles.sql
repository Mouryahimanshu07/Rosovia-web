-- =============================================================================
-- Rosovia Module 4: Creator Profile
-- Migration: 002_creator_profiles.sql
-- Depends on: 001_foundation.sql (profiles, categories, is_admin, set_updated_at)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.creator_profiles
-- ---------------------------------------------------------------------------

create table if not exists public.creator_profiles (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  display_name         text        not null,
  slug                 text        not null,
  bio                  text,
  story                text,
  primary_category_id  uuid        references public.categories(id),
  skills               text[]      not null default '{}',
  languages            text[]      not null default '{}',
  city                 text,
  state                text,
  country              text        not null default 'India',
  profile_image_url    text,
  intro_video_url      text,
  verification_level   text        not null default 'none',
  is_verified          boolean     not null default false,
  rating_avg           numeric     not null default 0,
  rating_count         integer     not null default 0,
  total_orders         integer     not null default 0,
  total_followers      integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz null,

  constraint creator_profiles_user_id_unique         unique (user_id),
  constraint creator_profiles_slug_unique             unique (slug),
  constraint creator_profiles_rating_avg_check        check (rating_avg between 0 and 5),
  constraint creator_profiles_rating_count_check      check (rating_count >= 0),
  constraint creator_profiles_total_orders_check      check (total_orders >= 0),
  constraint creator_profiles_total_followers_check   check (total_followers >= 0),
  constraint creator_profiles_verification_level_check check (
    verification_level in ('none', 'basic_verified', 'creator_verified', 'seller_verified', 'trusted_seller')
  )
);

-- Trigger: auto-update updated_at
drop trigger if exists set_creator_profiles_updated_at on public.creator_profiles;
create trigger set_creator_profiles_updated_at
  before update on public.creator_profiles
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists creator_profiles_user_id_idx             on public.creator_profiles(user_id);
create index if not exists creator_profiles_slug_idx                on public.creator_profiles(slug);
create index if not exists creator_profiles_primary_category_id_idx on public.creator_profiles(primary_category_id);
create index if not exists creator_profiles_is_verified_idx         on public.creator_profiles(is_verified);
create index if not exists creator_profiles_city_state_idx          on public.creator_profiles(city, state);
create index if not exists creator_profiles_created_at_idx          on public.creator_profiles(created_at);


-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.creator_profiles enable row level security;


-- 2a. Public can read active (non-deleted) creator profiles
drop policy if exists "creator_profiles: public can read active" on public.creator_profiles;
create policy "creator_profiles: public can read active"
  on public.creator_profiles
  for select
  using (deleted_at is null);


-- 2b. Creator can insert their own creator profile
--     Checks: user_id belongs to current auth user, role = creator, status = active
drop policy if exists "creator_profiles: creator can insert own" on public.creator_profiles;
create policy "creator_profiles: creator can insert own"
  on public.creator_profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id         = user_id
        and p.auth_user_id = auth.uid()
        and p.role       = 'creator'
        and p.status     = 'active'
        and p.deleted_at is null
    )
  );


-- 2c. Creator can update their own creator profile
--     Note: column-level write protection for is_verified, verification_level,
--     rating_avg, rating_count, total_orders, total_followers is enforced in
--     the service layer (those fields are excluded from Zod input schemas).
drop policy if exists "creator_profiles: creator can update own" on public.creator_profiles;
create policy "creator_profiles: creator can update own"
  on public.creator_profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id         = creator_profiles.user_id
        and p.auth_user_id = auth.uid()
        and p.role       = 'creator'
        and p.status     = 'active'
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id         = creator_profiles.user_id
        and p.auth_user_id = auth.uid()
        and p.role       = 'creator'
        and p.status     = 'active'
        and p.deleted_at is null
    )
  );


-- 2d. Admin can read all creator profiles (including deleted)
drop policy if exists "creator_profiles: admin can read all" on public.creator_profiles;
create policy "creator_profiles: admin can read all"
  on public.creator_profiles
  for select
  to authenticated
  using (public.is_admin());


-- 2e. Admin can update all creator profiles
drop policy if exists "creator_profiles: admin can update all" on public.creator_profiles;
create policy "creator_profiles: admin can update all"
  on public.creator_profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
