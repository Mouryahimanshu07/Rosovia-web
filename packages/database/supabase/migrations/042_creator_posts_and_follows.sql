-- =============================================================================
-- Rosovia Social Commerce: Creator Posts & Follows
-- Migration: 042_creator_posts_and_follows.sql
-- Purpose: Creator work posts for portfolio showcase, and creator follows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.creator_posts
-- ---------------------------------------------------------------------------
create table if not exists public.creator_posts (
  id                  uuid        primary key default gen_random_uuid(),
  creator_profile_id  uuid        not null references public.creator_profiles(id) on delete cascade,
  caption             text        null,
  post_type           text        not null check (post_type in ('image','short_video','portfolio','listing_showcase','carousel')),
  listing_id          uuid        null references public.listings(id) on delete set null,
  visibility          text        not null default 'public' check (visibility in ('public','followers','private')),
  moderation_status   text        not null default 'pending' check (moderation_status in ('pending','approved','rejected','hidden')),
  like_count          integer     not null default 0 check (like_count >= 0),
  save_count          integer     not null default 0 check (save_count >= 0),
  view_count          integer     not null default 0 check (view_count >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz null,

  constraint creator_posts_caption_length_check check (
    caption is null or char_length(caption) <= 2200
  )
);

drop trigger if exists set_creator_posts_updated_at on public.creator_posts;
create trigger set_creator_posts_updated_at
  before update on public.creator_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Table: public.creator_post_media
-- ---------------------------------------------------------------------------
create table if not exists public.creator_post_media (
  id              uuid    primary key default gen_random_uuid(),
  post_id         uuid    not null references public.creator_posts(id) on delete cascade,
  media_asset_id  uuid    not null references public.media_assets(id) on delete restrict,
  sort_order      integer not null default 0 check (sort_order >= 0),
  created_at      timestamptz not null default now(),

  constraint creator_post_media_unique unique (post_id, media_asset_id)
);

-- ---------------------------------------------------------------------------
-- 3. Table: public.creator_follows
-- ---------------------------------------------------------------------------
create table if not exists public.creator_follows (
  id                  uuid        primary key default gen_random_uuid(),
  follower_profile_id uuid        not null references public.profiles(id) on delete cascade,
  creator_profile_id  uuid        not null references public.creator_profiles(id) on delete cascade,
  created_at          timestamptz not null default now(),

  constraint creator_follows_unique unique (follower_profile_id, creator_profile_id)
);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

-- creator_posts
create index if not exists creator_posts_creator_profile_id_idx on public.creator_posts(creator_profile_id);
create index if not exists creator_posts_post_type_idx on public.creator_posts(post_type);
create index if not exists creator_posts_visibility_idx on public.creator_posts(visibility);
create index if not exists creator_posts_moderation_status_idx on public.creator_posts(moderation_status);
create index if not exists creator_posts_created_at_idx on public.creator_posts(created_at desc);
create index if not exists creator_posts_listing_id_idx on public.creator_posts(listing_id);
create index if not exists creator_posts_public_feed_idx on public.creator_posts(visibility, moderation_status, created_at desc);

-- creator_post_media
create index if not exists creator_post_media_post_id_sort_idx on public.creator_post_media(post_id, sort_order);
create index if not exists creator_post_media_media_asset_id_idx on public.creator_post_media(media_asset_id);

-- creator_follows
create index if not exists creator_follows_follower_profile_id_idx on public.creator_follows(follower_profile_id);
create index if not exists creator_follows_creator_profile_id_idx on public.creator_follows(creator_profile_id);
create index if not exists creator_follows_creator_profile_created_at_idx on public.creator_follows(creator_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Enable RLS
-- ---------------------------------------------------------------------------
alter table public.creator_posts enable row level security;
alter table public.creator_post_media enable row level security;
alter table public.creator_follows enable row level security;

-- ---------------------------------------------------------------------------
-- 6. RLS Policies: creator_posts
-- ---------------------------------------------------------------------------

-- Public can select approved public posts that are not deleted
drop policy if exists "creator_posts: public can read approved public" on public.creator_posts;
create policy "creator_posts: public can read approved public"
  on public.creator_posts
  for select
  using (
    visibility = 'public'
    and moderation_status = 'approved'
    and deleted_at is null
  );

-- Creator owner can select own posts (all statuses/visibility)
drop policy if exists "creator_posts: owner can read own" on public.creator_posts;
create policy "creator_posts: owner can read own"
  on public.creator_posts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_posts.creator_profile_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
    and deleted_at is null
  );

-- Creator owner can insert posts for their own profile
drop policy if exists "creator_posts: owner can insert" on public.creator_posts;
create policy "creator_posts: owner can insert"
  on public.creator_posts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_posts.creator_profile_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and cp.deleted_at is null
        and p.deleted_at is null
    )
    -- Creator cannot manually approve own posts
    and creator_posts.moderation_status = 'pending'
  );

-- Creator owner can update safe fields on own posts (not moderation_status)
drop policy if exists "creator_posts: owner can update safe fields" on public.creator_posts;
create policy "creator_posts: owner can update safe fields"
  on public.creator_posts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_posts.creator_profile_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
    and deleted_at is null
  )
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_posts.creator_profile_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
    -- Creator cannot self-approve: moderation_status must remain the same value when updated by owner
    -- Admin approval is done separately through admin-only RLS
  );

-- Creator owner can soft-delete own posts
drop policy if exists "creator_posts: owner can delete" on public.creator_posts;
create policy "creator_posts: owner can delete"
  on public.creator_posts
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_posts.creator_profile_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- Admin can select/update all posts for moderation
drop policy if exists "creator_posts: admin can select all" on public.creator_posts;
create policy "creator_posts: admin can select all"
  on public.creator_posts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "creator_posts: admin can update" on public.creator_posts;
create policy "creator_posts: admin can update"
  on public.creator_posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. RLS Policies: creator_post_media
-- ---------------------------------------------------------------------------

drop policy if exists "creator_post_media: public can read approved post media" on public.creator_post_media;
create policy "creator_post_media: public can read approved post media"
  on public.creator_post_media
  for select
  using (
    exists (
      select 1 from public.creator_posts cp
      where cp.id = creator_post_media.post_id
        and cp.visibility = 'public'
        and cp.moderation_status = 'approved'
        and cp.deleted_at is null
    )
  );

drop policy if exists "creator_post_media: owner can read own post media" on public.creator_post_media;
create policy "creator_post_media: owner can read own post media"
  on public.creator_post_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.creator_posts p2
      join public.creator_profiles cp on cp.id = p2.creator_profile_id
      join public.profiles pr on pr.id = cp.user_id
      where p2.id = creator_post_media.post_id
        and pr.auth_user_id = auth.uid()
        and p2.deleted_at is null
    )
  );

drop policy if exists "creator_post_media: owner can insert" on public.creator_post_media;
create policy "creator_post_media: owner can insert"
  on public.creator_post_media
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.creator_posts p2
      join public.creator_profiles cp on cp.id = p2.creator_profile_id
      join public.profiles pr on pr.id = cp.user_id
      where p2.id = creator_post_media.post_id
        and pr.auth_user_id = auth.uid()
        and p2.deleted_at is null
    )
  );

drop policy if exists "creator_post_media: owner can delete" on public.creator_post_media;
create policy "creator_post_media: owner can delete"
  on public.creator_post_media
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.creator_posts p2
      join public.creator_profiles cp on cp.id = p2.creator_profile_id
      join public.profiles pr on pr.id = cp.user_id
      where p2.id = creator_post_media.post_id
        and pr.auth_user_id = auth.uid()
        and p2.deleted_at is null
    )
  );

drop policy if exists "creator_post_media: admin can read all" on public.creator_post_media;
create policy "creator_post_media: admin can read all"
  on public.creator_post_media
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. RLS Policies: creator_follows
-- ---------------------------------------------------------------------------

-- Users can view their own follow rows
drop policy if exists "creator_follows: user can read own" on public.creator_follows;
create policy "creator_follows: user can read own"
  on public.creator_follows
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = creator_follows.follower_profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Admin can read all follows
drop policy if exists "creator_follows: admin can read all" on public.creator_follows;
create policy "creator_follows: admin can read all"
  on public.creator_follows
  for select
  to authenticated
  using (public.is_admin());

-- Users can insert only for their own profile
drop policy if exists "creator_follows: user can insert own" on public.creator_follows;
create policy "creator_follows: user can insert own"
  on public.creator_follows
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = creator_follows.follower_profile_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

-- Users can delete only their own follow rows
drop policy if exists "creator_follows: user can delete own" on public.creator_follows;
create policy "creator_follows: user can delete own"
  on public.creator_follows
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = creator_follows.follower_profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );
