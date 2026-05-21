-- =============================================================================
-- Rosovia Module 12: Reviews
-- Migration: 010_reviews.sql
-- Depends on: 001_foundation.sql (set_updated_at, is_admin, profiles),
--             002_creator_profiles.sql (creator_profiles),
--             003_listings.sql (listings),
--             004_media_assets.sql (media_assets),
--             008_orders.sql (orders)
-- Purpose: Creates public.reviews table for buyer-submitted creator/listing
--          reviews after a completed paid order. Includes rating aggregation
--          trigger to keep creator_profiles.rating_avg/rating_count in sync.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.reviews
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
  id                    uuid          primary key default gen_random_uuid(),
  order_id              uuid          not null references public.orders(id) on delete cascade,
  buyer_id              uuid          not null references public.profiles(id) on delete cascade,
  creator_id            uuid          not null references public.creator_profiles(id) on delete cascade,
  listing_id            uuid          null references public.listings(id) on delete set null,
  rating                integer       not null,
  quality_rating        integer       null,
  communication_rating  integer       null,
  delivery_rating       integer       null,
  comment               text          null,
  media_id              uuid          null references public.media_assets(id) on delete set null,
  is_hidden             boolean       not null default false,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),
  deleted_at            timestamptz   null,

  -- Overall rating must be 1–5
  constraint reviews_rating_check check (rating >= 1 and rating <= 5),

  -- Sub-ratings are nullable but must be 1–5 if provided
  constraint reviews_quality_rating_check check (
    quality_rating is null or (quality_rating >= 1 and quality_rating <= 5)
  ),
  constraint reviews_communication_rating_check check (
    communication_rating is null or (communication_rating >= 1 and communication_rating <= 5)
  ),
  constraint reviews_delivery_rating_check check (
    delivery_rating is null or (delivery_rating >= 1 and delivery_rating <= 5)
  ),

  -- Comment max 2000 characters
  constraint reviews_comment_length_check check (
    comment is null or char_length(comment) <= 2000
  )
);


-- ---------------------------------------------------------------------------
-- 2. One review per order (unique index on order_id)
-- ---------------------------------------------------------------------------

create unique index if not exists reviews_order_id_unique_idx
  on public.reviews(order_id);


-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

create index if not exists reviews_order_id_idx
  on public.reviews(order_id);

create index if not exists reviews_buyer_id_idx
  on public.reviews(buyer_id);

create index if not exists reviews_creator_id_idx
  on public.reviews(creator_id);

create index if not exists reviews_listing_id_idx
  on public.reviews(listing_id);

create index if not exists reviews_rating_idx
  on public.reviews(rating);

create index if not exists reviews_is_hidden_idx
  on public.reviews(is_hidden);

create index if not exists reviews_created_at_idx
  on public.reviews(created_at);

-- Compound indexes for common public display queries
create index if not exists reviews_creator_visible_idx
  on public.reviews(creator_id, is_hidden, created_at);

create index if not exists reviews_listing_visible_idx
  on public.reviews(listing_id, is_hidden, created_at);


-- ---------------------------------------------------------------------------
-- 5. Creator rating aggregation function
--    Recalculates creator_profiles.rating_avg and rating_count
--    from all visible, non-deleted reviews for the given creator.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_creator_rating(target_creator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg   numeric;
  v_count integer;
begin
  select
    coalesce(round(avg(rating)::numeric, 2), 0),
    coalesce(count(*), 0)
  into v_avg, v_count
  from public.reviews
  where creator_id = target_creator_id
    and is_hidden   = false
    and deleted_at  is null;

  update public.creator_profiles
  set
    rating_avg   = v_avg,
    rating_count = v_count
  where id = target_creator_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. Trigger function: fires recalculate_creator_rating on review change
-- ---------------------------------------------------------------------------

create or replace function public.trigger_recalculate_creator_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- On delete, use OLD row. On insert/update, use NEW row.
  -- Also handle UPDATE where creator_id changed (unusual but safe).
  if (TG_OP = 'DELETE') then
    perform public.recalculate_creator_rating(OLD.creator_id);
  elsif (TG_OP = 'UPDATE') then
    perform public.recalculate_creator_rating(NEW.creator_id);
    -- If creator_id somehow changed, recalculate old one too
    if NEW.creator_id <> OLD.creator_id then
      perform public.recalculate_creator_rating(OLD.creator_id);
    end if;
  else
    -- INSERT
    perform public.recalculate_creator_rating(NEW.creator_id);
  end if;
  return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. Attach rating aggregation trigger to public.reviews
-- ---------------------------------------------------------------------------

drop trigger if exists recalculate_creator_rating_trigger on public.reviews;
create trigger recalculate_creator_rating_trigger
  after insert or update or delete
  on public.reviews
  for each row execute function public.trigger_recalculate_creator_rating();


-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;


-- ---------------------------------------------------------------------------
-- 8a. Public (anon + authenticated) can read visible, non-deleted reviews
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: public can read visible" on public.reviews;
create policy "reviews: public can read visible"
  on public.reviews
  for select
  using (
    is_hidden  = false
    and deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 8b. Buyer can read own submitted reviews (including hidden ones)
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: buyer can read own" on public.reviews;
create policy "reviews: buyer can read own"
  on public.reviews
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = reviews.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- ---------------------------------------------------------------------------
-- 8c. Creator can read reviews for their creator profile
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: creator can read received" on public.reviews;
create policy "reviews: creator can read received"
  on public.reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = reviews.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
  );


-- ---------------------------------------------------------------------------
-- 8d. Buyer can insert a review
--     RLS enforces: buyer_id belongs to authenticated user, profile active,
--                   is_hidden must be false (buyer cannot hide own review).
--     Service layer enforces: order_status = completed, payment_status = paid,
--                             no duplicate review, creator_id/listing_id match.
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: buyer can create review" on public.reviews;
create policy "reviews: buyer can create review"
  on public.reviews
  for insert
  to authenticated
  with check (
    -- buyer_id must be current user's active profile
    exists (
      select 1 from public.profiles p
      where p.id = reviews.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    -- Buyer cannot set is_hidden = true
    and reviews.is_hidden = false
    -- deleted_at must be null on insert
    and reviews.deleted_at is null
  );


-- ---------------------------------------------------------------------------
-- 8e. Admin can read all reviews
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: admin can read all" on public.reviews;
create policy "reviews: admin can read all"
  on public.reviews
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 8f. Admin can update reviews (e.g. set is_hidden = true for moderation)
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: admin can update" on public.reviews;
create policy "reviews: admin can update"
  on public.reviews
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- NOTE: Buyer UPDATE policy is intentionally omitted in Module 12.
-- Reviews are create-once in the MVP. Editing support can be added later.
--
-- NOTE: The INSERT RLS policy cannot efficiently enforce order_status =
-- 'completed' and payment_status = 'paid' without complex subquery joins
-- that risk RLS recursion. The service layer (review.service.ts) is the
-- primary enforcement point for the completed + paid eligibility rule.
-- This is consistent with the approach used in orders and payments modules.
-- ---------------------------------------------------------------------------
