-- =============================================================================
-- Rosovia Module 2: Database Foundation
-- Migration: 001_foundation.sql
-- Description: Creates the initial profiles and categories tables with
--              RLS policies and supporting functions.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. Shared trigger function: set_updated_at
--    Automatically stamps updated_at on every row update.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. Table: public.profiles
--    One row per authenticated Supabase user. Soft-delete via deleted_at.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid        primary key default gen_random_uuid(),
  auth_user_id    uuid        unique not null references auth.users(id) on delete cascade,
  full_name       text,
  username        text        unique,
  email           text,
  phone           text,
  avatar_url      text,
  role            text        not null default 'buyer',
  city            text,
  state           text,
  country         text        not null default 'India',
  language        text,
  is_seller       boolean     not null default false,
  is_mentor       boolean     not null default false,
  is_business     boolean     not null default false,
  is_service_provider boolean not null default false,
  status          text        not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz null,

  constraint profiles_role_check   check (role   in ('buyer', 'creator', 'admin')),
  constraint profiles_status_check check (status in ('active', 'suspended', 'deleted'))
);

-- Trigger: auto-update updated_at
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists profiles_username_idx     on public.profiles(username);
create index if not exists profiles_role_idx         on public.profiles(role);
create index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index if not exists profiles_status_idx       on public.profiles(status);


-- ---------------------------------------------------------------------------
-- 3. Table: public.categories
--    Platform-managed categories. Seeded; not user-created.
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        unique not null,
  description text,
  priority    integer     not null,
  type        text        not null,
  icon_name   text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_type_check check (
    type in ('product', 'service', 'learning', 'performance', 'mixed')
  )
);

-- Trigger: auto-update updated_at
drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists categories_slug_idx      on public.categories(slug);
create index if not exists categories_priority_idx  on public.categories(priority);
create index if not exists categories_is_active_idx on public.categories(is_active);
create index if not exists categories_type_idx      on public.categories(type);


-- ---------------------------------------------------------------------------
-- 4. Admin helper: public.is_admin()
--    Safe helper to check whether the current user has an active admin profile.
--    Used inside RLS policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role       = 'admin'
      and status     = 'active'
      and deleted_at is null
  );
$$;


-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;


-- ---- profiles policies ----

-- 5a. Users can read their own profile
drop policy if exists "profiles: user can read own" on public.profiles;
create policy "profiles: user can read own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

-- 5b. Users can insert their own profile (buyer or creator only; admin not self-assignable)
drop policy if exists "profiles: user can insert own" on public.profiles;
create policy "profiles: user can insert own"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = auth_user_id
    and role in ('buyer', 'creator')
  );

-- 5c. Users can update their own profile (cannot escalate to admin)
drop policy if exists "profiles: user can update own" on public.profiles;
create policy "profiles: user can update own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (
    auth.uid() = auth_user_id
    -- Prevent role escalation: users may only keep buyer or creator on self-update.
    -- Admin role assignment is handled via service-role in a future Admin module.
    and role in ('buyer', 'creator')
  );

-- 5d. Admin can read all profiles
drop policy if exists "profiles: admin can read all" on public.profiles;
create policy "profiles: admin can read all"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- 5e. Admin can update all profiles
drop policy if exists "profiles: admin can update all" on public.profiles;
create policy "profiles: admin can update all"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- categories policies ----

-- 5f. Public (anon + authenticated) can read active categories
drop policy if exists "categories: public can read active" on public.categories;
create policy "categories: public can read active"
  on public.categories
  for select
  using (is_active = true);

-- 5g. Admin can insert categories
drop policy if exists "categories: admin can insert" on public.categories;
create policy "categories: admin can insert"
  on public.categories
  for insert
  to authenticated
  with check (public.is_admin());

-- 5h. Admin can update categories
drop policy if exists "categories: admin can update" on public.categories;
create policy "categories: admin can update"
  on public.categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5i. Admin can delete categories
drop policy if exists "categories: admin can delete" on public.categories;
create policy "categories: admin can delete"
  on public.categories
  for delete
  to authenticated
  using (public.is_admin());
