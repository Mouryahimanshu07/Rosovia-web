-- =============================================================================
-- Rosovia Step 26: Search Architecture Improvements
-- Migration: 034_search_improvements.sql
-- Depends on: 005_explore_search_indexes.sql, 003_listings.sql,
--             002_creator_profiles.sql, 008_orders.sql, 010_reviews.sql
-- Purpose:
--   Bug fixes:
--     B3  — Add GIN trigram index on creator_profiles.story (searched but unindexed)
--     B6  — Add GIN array indexes on skills[] and languages[]
--   Short-term improvements:
--     ST-4 — Add precomputed tsvector `search_doc` column on listings
--   Medium-term:
--     MT-1 — Create listing_signals materialized view (trending scores)
--     MT-2 — Create search_listings_ranked() RPC (blended relevance + trending)
--   Analytics:
--     B4   — Create listing_events table + record_listing_event() RPC
-- =============================================================================


-- ---------------------------------------------------------------------------
-- B3: GIN trigram index on creator_profiles.story
--     This column is ILIKE-searched in searchPublicCreators but had no index.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

create index if not exists creator_profiles_story_trgm_idx
  on public.creator_profiles using gin (story gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- B6: GIN array indexes on skills[] and languages[]
--     Enables future @> (contains) filtering on these arrays.
-- ---------------------------------------------------------------------------

create index if not exists creator_profiles_skills_gin_idx
  on public.creator_profiles using gin (skills);

create index if not exists creator_profiles_languages_gin_idx
  on public.creator_profiles using gin (languages);


-- ---------------------------------------------------------------------------
-- ST-4: Precomputed tsvector search_doc column on listings
--
--   Weight A — title        (most important)
--   Weight B — description  (full text body)
--
--   Uses 'english' dictionary for stemming (yoga→yoga, paintings→painting).
--   STORED means it is maintained automatically by Postgres on INSERT/UPDATE.
--   GIN index makes @@ (ts_query match) and ts_rank() extremely fast.
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists listings_search_doc_gin_idx
  on public.listings using gin (search_doc);


-- ---------------------------------------------------------------------------
-- MT-1: listing_signals — Materialized view for pre-aggregated ranking signals
--
--   Aggregates behavioral signals available in the DB:
--     - rating_avg / rating_count from creator_profiles (trigger-maintained)
--     - is_verified, verification_level from creator_profiles
--     - recent order velocity (last 30 days)
--     - recent review velocity (last 60 days)
--     - composite trending_score (0–230 range)
--
--   Refresh strategy: call refresh_listing_signals() via a scheduled job
--   (pg_cron, Supabase Edge Function cron, or external cron) every 15 minutes.
-- ---------------------------------------------------------------------------

drop materialized view if exists public.listing_signals;

create materialized view public.listing_signals as
select
  l.id                                              as listing_id,
  l.creator_id,
  l.category_id,
  l.city                                            as listing_city,
  l.state                                           as listing_state,

  -- Creator quality signals
  cp.rating_avg,
  cp.rating_count,
  cp.total_orders,
  cp.is_verified,
  cp.verification_level,
  cp.city                                           as creator_city,
  cp.state                                          as creator_state,
  cp.display_name                                   as creator_display_name,

  -- Recency: orders completed in last 30 days (capped at 50 to prevent runaway)
  least(
    count(o.id) filter (
      where o.created_at > now() - interval '30 days'
        and o.order_status in ('completed', 'delivered')
    ),
    50
  )::integer                                         as recent_orders_30d,

  -- Engagement: reviews in last 60 days (capped at 20)
  least(
    count(r.id) filter (
      where r.created_at > now() - interval '60 days'
        and r.is_hidden = false
        and r.deleted_at is null
    ),
    20
  )::integer                                         as recent_reviews_60d,

  -- Composite trending_score (range ≈ 0–230)
  --   Quality anchor  : rating_avg * 20   → 0–100
  --   Trust signal    : is_verified * 10  → 0–10
  --   Order velocity  : recent_orders * 2 → 0–100
  --   Review velocity : recent_reviews    → 0–20
  round(
    cp.rating_avg * 20.0
    + (cp.is_verified::int) * 10.0
    + least(
        count(o.id) filter (
          where o.created_at > now() - interval '30 days'
            and o.order_status in ('completed', 'delivered')
        ),
        50
      ) * 2.0
    + least(
        count(r.id) filter (
          where r.created_at > now() - interval '60 days'
            and r.is_hidden = false
            and r.deleted_at is null
        ),
        20
      ) * 1.0,
    2
  )                                                  as trending_score,

  now()                                              as computed_at

from public.listings l
join public.creator_profiles cp on cp.id = l.creator_id
left join public.orders o on o.listing_id = l.id
left join public.reviews r on r.listing_id = l.id

where l.status = 'approved'
  and l.deleted_at is null
  and cp.deleted_at is null

group by
  l.id,
  l.creator_id,
  l.category_id,
  l.city,
  l.state,
  cp.rating_avg,
  cp.rating_count,
  cp.total_orders,
  cp.is_verified,
  cp.verification_level,
  cp.city,
  cp.state,
  cp.display_name;

-- Indexes on the materialized view for fast joins and sorts
create unique index if not exists listing_signals_listing_id_idx
  on public.listing_signals (listing_id);

create index if not exists listing_signals_trending_idx
  on public.listing_signals (trending_score desc);

create index if not exists listing_signals_creator_id_idx
  on public.listing_signals (creator_id);

create index if not exists listing_signals_category_idx
  on public.listing_signals (category_id, trending_score desc);


-- ---------------------------------------------------------------------------
-- Refresh function: call this to rebuild listing_signals concurrently
--   CONCURRENTLY requires a unique index (listing_signals_listing_id_idx above)
--   and allows reads to continue during refresh.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_listing_signals()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.listing_signals;
$$;


-- ---------------------------------------------------------------------------
-- MT-2: search_listings_ranked() — Blended relevance + trending RPC
--
--   Blended score formula:
--     When a query `q` is provided:
--       blended = ts_rank(search_doc, query) * 60.0  (relevance dominates)
--               + trending_score * 0.4              (quality signal)
--               + location_boost                    (0 or 5)
--               + verified_boost                    (0 or 4)
--               + recency_decay                     (0–10)
--     When no query (browse mode):
--       blended = trending_score                    (pure quality ranking)
--               + location_boost
--               + verified_boost
--               + recency_decay
--
--   Match strategy:
--     1. tsvector @@ (full-text match — fast, stemmed, phrase-aware)
--     2. OR similarity(title, q) > 0.15 (trigram fuzzy fallback for typos)
--
--   Returns one extra row (LIMIT page_size + 1) so the caller can detect
--   hasNext without an expensive COUNT(*).
-- ---------------------------------------------------------------------------

create or replace function public.search_listings_ranked(
  p_query        text    default null,
  p_category     uuid    default null,
  p_listing_type text    default null,
  p_min_price    numeric default null,
  p_max_price    numeric default null,
  p_city         text    default null,
  p_state        text    default null,
  p_buyer_city   text    default null,   -- optional: buyer's city for location boost
  p_buyer_state  text    default null,   -- optional: buyer's state for location boost
  p_custom_order boolean default null,
  p_online       boolean default null,
  p_offline      boolean default null,
  p_verified_only boolean default null,
  p_sort         text    default 'relevance',
  p_page         integer default 1,
  p_page_size    integer default 12
)
returns table (
  id                    uuid,
  creator_id            uuid,
  category_id           uuid,
  listing_type          text,
  title                 text,
  slug                  text,
  description           text,
  price                 numeric,
  currency              text,
  stock                 integer,
  city                  text,
  state                 text,
  custom_order_available boolean,
  delivery_available    boolean,
  online_available      boolean,
  offline_available     boolean,
  status                text,
  verification_status   text,
  metadata              jsonb,
  created_at            timestamptz,
  updated_at            timestamptz,
  deleted_at            timestamptz,
  -- Joined denormalized fields
  creator_display_name  text,
  creator_slug          text,
  category_name         text,
  -- Score breakdown
  relevance_score       float,
  trending_score        numeric,
  blended_score         float
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      l.*,
      cp.display_name            as creator_display_name,
      cp.slug                    as creator_slug,
      cp.is_verified             as creator_is_verified,
      cp.rating_avg              as rating_avg,
      cat.name                   as category_name,
      coalesce(ls.trending_score, 0) as t_score,

      -- Text relevance score (0–1)
      case
        when p_query is not null and p_query != ''
          then ts_rank(l.search_doc, plainto_tsquery('english', p_query))
        else 0.0
      end as r_score,

      -- Location affinity boost
      case
        when p_buyer_city is not null
          and lower(coalesce(l.city, '')) = lower(p_buyer_city)
          then 5.0
        when p_buyer_state is not null
          and lower(coalesce(l.state, '')) = lower(p_buyer_state)
          then 2.0
        else 0.0
      end as loc_boost,

      -- Verified creator boost
      case when cp.is_verified then 4.0 else 0.0 end as ver_boost,

      -- Recency decay: 0–10 for listings created within last 30 days
      greatest(
        0.0,
        10.0 - (extract(epoch from (now() - l.created_at)) / 86400.0)::float * (10.0 / 30.0)
      ) as rec_boost

    from public.listings l
    join public.creator_profiles cp on cp.id = l.creator_id
    join public.profiles pf on pf.id = cp.user_id
    join public.categories cat on cat.id = l.category_id
    left join public.listing_signals ls on ls.listing_id = l.id

    where l.status = 'approved'
      and l.deleted_at is null
      and cp.deleted_at is null
      and pf.status = 'active'
      and pf.deleted_at is null

      -- Category filter
      and (p_category is null or l.category_id = p_category)

      -- Listing type filter
      and (p_listing_type is null or l.listing_type = p_listing_type)

      -- Price range
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)

      -- Location filters
      and (p_city is null or lower(l.city) ilike '%' || lower(p_city) || '%')
      and (p_state is null or lower(l.state) ilike '%' || lower(p_state) || '%')

      -- Delivery/availability flags
      and (p_custom_order is null or p_custom_order = false or l.custom_order_available = true)
      and (p_online is null or p_online = false or l.online_available = true)
      and (p_offline is null or p_offline = false or l.offline_available = true)

      -- Verified creator filter
      and (p_verified_only is null or p_verified_only = false or cp.is_verified = true)

      -- Text search: tsvector match OR trigram fuzzy fallback
      and (
        p_query is null
        or p_query = ''
        or l.search_doc @@ plainto_tsquery('english', p_query)
        or similarity(l.title, p_query) > 0.15
      )
  )
  select
    b.id,
    b.creator_id,
    b.category_id,
    b.listing_type,
    b.title,
    b.slug,
    b.description,
    b.price,
    b.currency,
    b.stock,
    b.city,
    b.state,
    b.custom_order_available,
    b.delivery_available,
    b.online_available,
    b.offline_available,
    b.status,
    b.verification_status,
    b.metadata,
    b.created_at,
    b.updated_at,
    b.deleted_at,
    b.creator_display_name,
    b.creator_slug,
    b.category_name,
    b.r_score                                              as relevance_score,
    b.t_score                                              as trending_score,
    -- Blended score
    case
      when p_sort = 'trending' then
        b.t_score + b.loc_boost + b.ver_boost + b.rec_boost
      when p_sort = 'rating_high' then
        -- Delegate: sort col handled in ORDER BY below; use t_score as proxy
        b.t_score
      when p_sort = 'price_low' or p_sort = 'price_high' then
        -- Delegate: pure price sort — blended score unused
        0.0
      else
        -- relevance (default when q present) or fallback to trending
        (b.r_score * 60.0)
        + (b.t_score * 0.4)
        + b.loc_boost
        + b.ver_boost
        + b.rec_boost
    end                                                    as blended_score

  from base b

  order by
    case when p_sort = 'price_low'   then b.price end asc  nulls last,
    case when p_sort = 'price_high'  then b.price end desc nulls last,
    case when p_sort = 'rating_high' then b.rating_avg end desc nulls last,
    -- Default / relevance / trending: use blended_score
    case
      when p_sort not in ('price_low', 'price_high', 'rating_high') then
        case
          when p_sort = 'trending' then
            b.t_score + b.loc_boost + b.ver_boost + b.rec_boost
          else
            (b.r_score * 60.0) + (b.t_score * 0.4) + b.loc_boost + b.ver_boost + b.rec_boost
        end
    end desc nulls last,
    b.created_at desc

  limit p_page_size + 1
  offset (p_page - 1) * p_page_size;
$$;


-- ---------------------------------------------------------------------------
-- B4: listing_events — Persists view/click signals for future ranking use
--
--   Lightweight append-only event table. Written from Next.js server actions,
--   not directly from the browser (no RLS write for anon users).
--   Partitioned by month for easy pruning (optional — simple table for now).
-- ---------------------------------------------------------------------------

create table if not exists public.listing_events (
  id          bigserial     primary key,
  listing_id  uuid          not null references public.listings(id) on delete cascade,
  event_type  text          not null,
  session_id  text          null,   -- anonymous session ID (not PII)
  created_at  timestamptz   not null default now(),

  constraint listing_events_event_type_check check (
    event_type in ('view', 'click', 'inquiry_start', 'order_start')
  )
);

-- Indexes for signal aggregation queries
create index if not exists listing_events_listing_id_idx
  on public.listing_events (listing_id, created_at desc);

create index if not exists listing_events_type_created_idx
  on public.listing_events (event_type, created_at desc);

-- RLS: listing_events — service_role only (server-side writes, no direct client writes)
alter table public.listing_events enable row level security;

-- Admins can read all events
drop policy if exists "listing_events: admin can read" on public.listing_events;
create policy "listing_events: admin can read"
  on public.listing_events
  for select
  to authenticated
  using (public.is_admin());


-- RPC to record an event safely from the service layer
-- Called from Next.js server action (service_role bypass) — not exposed to anon clients.
create or replace function public.record_listing_event(
  p_listing_id  uuid,
  p_event_type  text,
  p_session_id  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Silently ignore unknown event types to avoid runtime errors
  if p_event_type not in ('view', 'click', 'inquiry_start', 'order_start') then
    return;
  end if;

  -- Silently ignore if listing does not exist (e.g. deleted between render and event)
  if not exists (select 1 from public.listings where id = p_listing_id) then
    return;
  end if;

  insert into public.listing_events (listing_id, event_type, session_id)
  values (p_listing_id, p_event_type, p_session_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- Grant execute on new RPCs to authenticated and anon roles
-- ---------------------------------------------------------------------------

grant execute on function public.search_listings_ranked(
  text, uuid, text, numeric, numeric, text, text, text, text,
  boolean, boolean, boolean, boolean, text, integer, integer
) to anon, authenticated;

grant execute on function public.refresh_listing_signals() to authenticated;
grant execute on function public.record_listing_event(uuid, text, text) to authenticated;
