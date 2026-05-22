-- =============================================================================
-- Rosovia Step 13: Marketplace KPI & Analytics Migration
-- Migration: 035_marketplace_kpis.sql
-- Depends on:
--   001_foundation.sql
--   006_inquiries.sql
--   008_orders.sql
--   019_refunds_disputes_payouts.sql
-- Purpose: Provide real-time, high-fidelity platform and transactional
--          KPI summaries as optimized views and security-definer RPCs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. view public.marketplace_kpi_summary
--    A real-time transactional summary view for admin and platform dashboards.
-- ---------------------------------------------------------------------------

create or replace view public.marketplace_kpi_summary as
with financials_30 as (
  select 
    coalesce(sum(amount), 0)::numeric(12, 2) as gmv_30_days,
    coalesce(sum(amount * 0.05), 0)::numeric(12, 2) as take_rate_30_days,
    count(*)::bigint as total_orders_completed_30_days,
    case 
      when count(*) > 0 then (coalesce(sum(amount), 0) / count(*))::numeric(12, 2)
      else 0.00
    end as aov_30_days
  from public.orders
  where 
    order_status in ('paid', 'delivered', 'completed')
    and deleted_at is null
    and created_at >= now() - interval '30 days'
),
retention_90 as (
  with buyer_orders as (
    select 
      buyer_id,
      count(id) as total_paid_orders
    from public.orders
    where 
      order_status in ('paid', 'delivered', 'completed')
      and deleted_at is null
      and created_at >= now() - interval '90 days'
    group by buyer_id
  )
  select
    coalesce(
      (count(case when total_paid_orders >= 2 then 1 end)::float / nullif(count(buyer_id), 0)) * 100, 
      0.0
    )::numeric(5, 2) as repeat_purchase_rate_90_days
  from buyer_orders
),
conversions_14 as (
  with inquiry_conversions as (
    select 
      i.id as inquiry_id,
      count(o.id) filter (where o.order_status in ('paid', 'delivered', 'completed')) as has_converted_order
    from public.inquiries i
    left join public.orders o on 
      o.buyer_id = i.buyer_id 
      and o.creator_id = i.creator_id
      and o.created_at between i.created_at and i.created_at + interval '14 days'
    where 
      i.deleted_at is null
      and i.created_at >= now() - interval '30 days'
    group by i.id
  )
  select
    coalesce(
      (count(case when has_converted_order > 0 then 1 end)::float / nullif(count(inquiry_id), 0)) * 100,
      0.0
    )::numeric(5, 2) as inquiry_to_order_conversion_rate_pct
  from inquiry_conversions
),
friction as (
  with order_totals as (
    select 
      count(id) as total_completed_attempts,
      count(id) filter (where order_status = 'refunded') as refunded_orders_count
    from public.orders
    where 
      order_status in ('completed', 'delivered', 'refunded')
      and deleted_at is null
  ),
  dispute_totals as (
    select count(id) as total_disputes_raised
    from public.disputes
    where deleted_at is null
  )
  select
    coalesce(
      (ot.refunded_orders_count::float / nullif(ot.total_completed_attempts, 0)) * 100,
      0.0
    )::numeric(5, 2) as refund_rate_pct,
    coalesce(
      (dt.total_disputes_raised::float / nullif(ot.total_completed_attempts, 0)) * 100,
      0.0
    )::numeric(5, 2) as dispute_rate_pct
  from order_totals ot, dispute_totals dt
)
select
  f30.gmv_30_days,
  f30.take_rate_30_days,
  f30.total_orders_completed_30_days,
  f30.aov_30_days,
  r90.repeat_purchase_rate_90_days,
  c14.inquiry_to_order_conversion_rate_pct,
  fr.refund_rate_pct,
  fr.dispute_rate_pct
from 
  financials_30 f30,
  retention_90 r90,
  conversions_14 c14,
  friction fr;



-- ---------------------------------------------------------------------------
-- 2. public.get_marketplace_kpi_summary_atomic
--    RPC wrapper to fetch the KPI view. Definer security grants read access
--    exclusively to active administrators.
-- ---------------------------------------------------------------------------

create or replace function public.get_marketplace_kpi_summary_atomic()
returns table (
  gmv_30_days                           numeric(12, 2),
  take_rate_30_days                     numeric(12, 2),
  total_orders_completed_30_days        bigint,
  aov_30_days                           numeric(12, 2),
  repeat_purchase_rate_90_days          numeric(5, 2),
  inquiry_to_order_conversion_rate_pct  numeric(5, 2),
  refund_rate_pct                       numeric(5, 2),
  dispute_rate_pct                      numeric(5, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role       text;
begin
  -- 1. Validate authorization
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  select role into v_role
  from public.profiles
  where id = v_profile_id and deleted_at is null;

  if v_role <> 'admin' then
    raise exception 'Admin privileges required' using errcode = 'P0002';
  end if;

  -- 2. Fetch summary view
  return query
  select * from public.marketplace_kpi_summary;
end;
$$;
