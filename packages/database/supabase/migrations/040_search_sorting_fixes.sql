-- =============================================================================
-- Rosovia Step 32: Search Sorting Fixes
-- Migration: 040_search_sorting_fixes.sql
-- Purpose: Fix the sorting bug in search_listings_ranked() RPC where rating_high sorted by relevance instead of creator's rating_avg.
-- =============================================================================

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

grant execute on function public.search_listings_ranked(
  text, uuid, text, numeric, numeric, text, text, text, text,
  boolean, boolean, boolean, boolean, text, integer, integer
) to anon, authenticated;
