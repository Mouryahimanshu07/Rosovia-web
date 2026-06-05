-- =============================================================================
-- Rosovia Social Commerce: Universal User Profiles & Follows
-- Migration: 045_universal_user_profiles_and_follows.sql
-- Purpose: Adds cover_image_url and bio to public.profiles, and implements the
--          universal profile_follows table for buyer-to-buyer, buyer-to-creator,
--          and creator-to-creator follows.
-- =============================================================================

-- 1. Alter public.profiles table to support cover banner and biography
alter table public.profiles
  add column if not exists cover_image_url text null,
  add column if not exists bio text null;

-- 2. Create public.profile_follows table
create table if not exists public.profile_follows (
  id                   uuid        primary key default gen_random_uuid(),
  follower_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  following_profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at           timestamptz not null default now(),

  constraint profile_follows_unique unique (follower_profile_id, following_profile_id),
  constraint profile_follows_no_self_follow check (follower_profile_id <> following_profile_id)
);

-- 3. Indexes for profile_follows
create index if not exists profile_follows_follower_idx on public.profile_follows(follower_profile_id);
create index if not exists profile_follows_following_idx on public.profile_follows(following_profile_id);

-- 4. Enable Row Level Security (RLS)
alter table public.profile_follows enable row level security;

-- 5. RLS Policies: profile_follows

-- 5a. Public can select follows (safely count followers/following)
drop policy if exists "profile_follows: public can read follows" on public.profile_follows;
create policy "profile_follows: public can read follows"
  on public.profile_follows
  for select
  using (true);

-- 5b. Authenticated users can insert follows only for themselves
drop policy if exists "profile_follows: user can insert own follows" on public.profile_follows;
create policy "profile_follows: user can insert own follows"
  on public.profile_follows
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = follower_profile_id
        and p.auth_user_id = auth.uid()
    )
  );

-- 5c. Authenticated users can delete follows only for themselves
drop policy if exists "profile_follows: user can delete own follows" on public.profile_follows;
create policy "profile_follows: user can delete own follows"
  on public.profile_follows
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = follower_profile_id
        and p.auth_user_id = auth.uid()
    )
  );
