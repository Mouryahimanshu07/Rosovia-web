-- =============================================================================
-- Rosovia Module: Refunds, Disputes, and Creator Payouts
-- Migration: 019_refunds_disputes_payouts.sql
-- Depends on:
--   001_foundation.sql              -> profiles, is_admin(), set_updated_at()
--   002_creator_profiles.sql        -> creator_profiles
--   008_orders.sql                  -> orders
--   009_payments.sql                -> payments
--   012_reports_moderation.sql      -> admin_actions
--   013_admin_dashboard_support.sql -> extended admin action types
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Helper: current active profile id
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and p.deleted_at is null
  limit 1;
$$;


-- ---------------------------------------------------------------------------
-- 1. Extend admin_actions constraints for refund/dispute/payout audit logs
-- ---------------------------------------------------------------------------

alter table public.admin_actions
  drop constraint if exists admin_actions_action_type_check;

alter table public.admin_actions
  add constraint admin_actions_action_type_check check (
    action_type in (
      -- Report moderation
      'report_reviewed',
      'report_resolved',
      'report_rejected',

      -- Review moderation
      'review_hidden',
      'review_unhidden',

      -- Listing moderation
      'listing_suspended',
      'listing_unsuspended',
      'listing_approved',
      'listing_rejected',

      -- User/creator moderation
      'user_suspended',
      'user_unsuspended',
      'creator_suspended',
      'creator_unsuspended',

      -- Verification
      'verification_reviewed',

      -- Category management
      'category_created',
      'category_updated',

      -- Refund lifecycle
      'refund_requested',
      'refund_approved',
      'refund_rejected',
      'refund_processed',
      'refund_failed',
      'refund_cancelled',

      -- Dispute lifecycle
      'dispute_opened',
      'dispute_under_review',
      'dispute_resolved',
      'dispute_rejected',

      -- Creator payout lifecycle
      'payout_created',
      'payout_processing',
      'payout_paid',
      'payout_failed',
      'payout_on_hold',

      -- Generic
      'manual_note'
    )
  );

alter table public.admin_actions
  drop constraint if exists admin_actions_target_type_check;

alter table public.admin_actions
  add constraint admin_actions_target_type_check check (
    target_type in (
      'report',
      'category',
      'creator',
      'listing',
      'review',
      'user',
      'verification_request',
      'order',
      'payment',
      'refund_request',
      'dispute',
      'creator_payout'
    )
  );


-- ---------------------------------------------------------------------------
-- 2. Table: refund_requests
--    Buyer refund requests linked to orders and payments.
-- ---------------------------------------------------------------------------

create table if not exists public.refund_requests (
  id              uuid          primary key default gen_random_uuid(),

  order_id        uuid          not null references public.orders(id) on delete cascade,
  payment_id      uuid          not null references public.payments(id) on delete cascade,
  buyer_id        uuid          not null references public.profiles(id) on delete cascade,

  amount          numeric       not null,
  currency        text          not null default 'INR',

  reason          text          not null,
  description     text          null,

  status          text          not null default 'requested',

  admin_note      text          null,
  reviewed_by     uuid          null references public.profiles(id) on delete set null,
  reviewed_at     timestamptz   null,

  provider_refund_id text       null,
  processed_at    timestamptz   null,
  failure_reason  text          null,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  deleted_at      timestamptz   null,

  constraint refund_requests_amount_check check (amount > 0),

  constraint refund_requests_currency_check check (
    currency in ('INR', 'USD')
  ),

  constraint refund_requests_status_check check (
    status in (
      'requested',
      'approved',
      'rejected',
      'processed',
      'failed',
      'cancelled'
    )
  ),

  constraint refund_requests_reason_check check (
    reason in (
      'duplicate_payment',
      'wrong_item',
      'not_delivered',
      'poor_quality',
      'creator_cancelled',
      'buyer_cancelled',
      'fraud_suspected',
      'other'
    )
  ),

  constraint refund_requests_description_length_check check (
    description is null or char_length(description) <= 2000
  ),

  constraint refund_requests_admin_note_length_check check (
    admin_note is null or char_length(admin_note) <= 2000
  ),

  constraint refund_requests_failure_reason_length_check check (
    failure_reason is null or char_length(failure_reason) <= 2000
  )
);

drop trigger if exists set_refund_requests_updated_at on public.refund_requests;
create trigger set_refund_requests_updated_at
  before update on public.refund_requests
  for each row execute function public.set_updated_at();

create index if not exists refund_requests_order_id_idx
  on public.refund_requests(order_id);

create index if not exists refund_requests_payment_id_idx
  on public.refund_requests(payment_id);

create index if not exists refund_requests_buyer_id_idx
  on public.refund_requests(buyer_id);

create index if not exists refund_requests_status_idx
  on public.refund_requests(status);

create index if not exists refund_requests_created_at_idx
  on public.refund_requests(created_at);

create unique index if not exists refund_requests_one_active_per_order_idx
  on public.refund_requests(order_id)
  where deleted_at is null
    and status in ('requested', 'approved');


-- ---------------------------------------------------------------------------
-- 3. Table: disputes
--    Buyer/creator disputes linked to an order.
-- ---------------------------------------------------------------------------

create table if not exists public.disputes (
  id                uuid          primary key default gen_random_uuid(),

  order_id          uuid          not null references public.orders(id) on delete cascade,
  opened_by         uuid          not null references public.profiles(id) on delete cascade,

  reason            text          not null,
  description       text          null,

  status            text          not null default 'open',

  resolution_note   text          null,
  resolved_by       uuid          null references public.profiles(id) on delete set null,
  resolved_at       timestamptz   null,

  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz   null,

  constraint disputes_status_check check (
    status in (
      'open',
      'under_review',
      'resolved',
      'rejected'
    )
  ),

  constraint disputes_reason_check check (
    reason in (
      'payment_issue',
      'not_delivered',
      'late_delivery',
      'quality_issue',
      'wrong_item',
      'miscommunication',
      'fraud_suspected',
      'abusive_behavior',
      'other'
    )
  ),

  constraint disputes_description_length_check check (
    description is null or char_length(description) <= 3000
  ),

  constraint disputes_resolution_note_length_check check (
    resolution_note is null or char_length(resolution_note) <= 3000
  )
);

drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

create index if not exists disputes_order_id_idx
  on public.disputes(order_id);

create index if not exists disputes_opened_by_idx
  on public.disputes(opened_by);

create index if not exists disputes_status_idx
  on public.disputes(status);

create index if not exists disputes_created_at_idx
  on public.disputes(created_at);

create unique index if not exists disputes_one_active_per_order_idx
  on public.disputes(order_id)
  where deleted_at is null
    and status in ('open', 'under_review');


-- ---------------------------------------------------------------------------
-- 4. Table: creator_payouts
--    Tracks creator settlement/payout for paid orders.
-- ---------------------------------------------------------------------------

create table if not exists public.creator_payouts (
  id                  uuid          primary key default gen_random_uuid(),

  creator_id          uuid          not null references public.creator_profiles(id) on delete cascade,
  order_id            uuid          not null references public.orders(id) on delete cascade,
  payment_id          uuid          null references public.payments(id) on delete set null,

  amount              numeric       not null,
  currency            text          not null default 'INR',

  status              text          not null default 'pending',

  provider            text          null,
  provider_reference  text          null,

  scheduled_at        timestamptz   null,
  processing_started_at timestamptz null,
  paid_at             timestamptz   null,

  failure_reason      text          null,
  admin_note          text          null,

  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  deleted_at          timestamptz   null,

  constraint creator_payouts_amount_check check (amount >= 0),

  constraint creator_payouts_currency_check check (
    currency in ('INR', 'USD')
  ),

  constraint creator_payouts_status_check check (
    status in (
      'pending',
      'processing',
      'paid',
      'failed',
      'on_hold',
      'cancelled'
    )
  ),

  constraint creator_payouts_provider_check check (
    provider is null or provider in ('manual', 'razorpayx', 'bank_transfer')
  ),

  constraint creator_payouts_failure_reason_length_check check (
    failure_reason is null or char_length(failure_reason) <= 2000
  ),

  constraint creator_payouts_admin_note_length_check check (
    admin_note is null or char_length(admin_note) <= 2000
  )
);

drop trigger if exists set_creator_payouts_updated_at on public.creator_payouts;
create trigger set_creator_payouts_updated_at
  before update on public.creator_payouts
  for each row execute function public.set_updated_at();

create index if not exists creator_payouts_creator_id_idx
  on public.creator_payouts(creator_id);

create index if not exists creator_payouts_order_id_idx
  on public.creator_payouts(order_id);

create index if not exists creator_payouts_payment_id_idx
  on public.creator_payouts(payment_id);

create index if not exists creator_payouts_status_idx
  on public.creator_payouts(status);

create index if not exists creator_payouts_created_at_idx
  on public.creator_payouts(created_at);

create unique index if not exists creator_payouts_one_active_per_order_idx
  on public.creator_payouts(order_id)
  where deleted_at is null
    and status <> 'cancelled';


-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.refund_requests enable row level security;
alter table public.disputes enable row level security;
alter table public.creator_payouts enable row level security;


-- ---------------------------------------------------------------------------
-- 5A. refund_requests RLS
-- ---------------------------------------------------------------------------

drop policy if exists "refund_requests: buyer can insert own" on public.refund_requests;
create policy "refund_requests: buyer can insert own"
  on public.refund_requests
  for insert
  to authenticated
  with check (
    buyer_id = public.current_profile_id()
    and status = 'requested'
    and deleted_at is null
    and exists (
      select 1
      from public.orders o
      where o.id = refund_requests.order_id
        and o.buyer_id = public.current_profile_id()
        and o.payment_status in ('paid', 'partially_refunded')
        and o.order_status not in ('refunded', 'cancelled')
        and o.deleted_at is null
    )
    and exists (
      select 1
      from public.payments p
      where p.id = refund_requests.payment_id
        and p.order_id = refund_requests.order_id
        and p.status in ('paid', 'partially_refunded')
        and p.deleted_at is null
    )
  );

drop policy if exists "refund_requests: buyer can read own" on public.refund_requests;
create policy "refund_requests: buyer can read own"
  on public.refund_requests
  for select
  to authenticated
  using (
    buyer_id = public.current_profile_id()
    and deleted_at is null
  );

drop policy if exists "refund_requests: creator can read assigned" on public.refund_requests;
create policy "refund_requests: creator can read assigned"
  on public.refund_requests
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.orders o
      join public.creator_profiles cp on cp.id = o.creator_id
      where o.id = refund_requests.order_id
        and cp.user_id = public.current_profile_id()
        and o.deleted_at is null
        and cp.deleted_at is null
    )
  );

drop policy if exists "refund_requests: admin can read all" on public.refund_requests;
create policy "refund_requests: admin can read all"
  on public.refund_requests
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "refund_requests: admin can update all" on public.refund_requests;
create policy "refund_requests: admin can update all"
  on public.refund_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "refund_requests: admin can insert" on public.refund_requests;
create policy "refund_requests: admin can insert"
  on public.refund_requests
  for insert
  to authenticated
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5B. disputes RLS
-- ---------------------------------------------------------------------------

drop policy if exists "disputes: buyer or creator can insert own" on public.disputes;
create policy "disputes: buyer or creator can insert own"
  on public.disputes
  for insert
  to authenticated
  with check (
    opened_by = public.current_profile_id()
    and status = 'open'
    and deleted_at is null
    and exists (
      select 1
      from public.orders o
      left join public.creator_profiles cp on cp.id = o.creator_id
      where o.id = disputes.order_id
        and o.deleted_at is null
        and o.order_status in (
          'payment_pending',
          'accepted',
          'paid',
          'in_progress',
          'shipped',
          'delivered',
          'completed',
          'disputed'
        )
        and (
          o.buyer_id = public.current_profile_id()
          or cp.user_id = public.current_profile_id()
        )
    )
  );

drop policy if exists "disputes: buyer can read own order dispute" on public.disputes;
create policy "disputes: buyer can read own order dispute"
  on public.disputes
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.orders o
      where o.id = disputes.order_id
        and o.buyer_id = public.current_profile_id()
        and o.deleted_at is null
    )
  );

drop policy if exists "disputes: creator can read assigned order dispute" on public.disputes;
create policy "disputes: creator can read assigned order dispute"
  on public.disputes
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.orders o
      join public.creator_profiles cp on cp.id = o.creator_id
      where o.id = disputes.order_id
        and cp.user_id = public.current_profile_id()
        and o.deleted_at is null
        and cp.deleted_at is null
    )
  );

drop policy if exists "disputes: admin can read all" on public.disputes;
create policy "disputes: admin can read all"
  on public.disputes
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "disputes: admin can update all" on public.disputes;
create policy "disputes: admin can update all"
  on public.disputes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "disputes: admin can insert" on public.disputes;
create policy "disputes: admin can insert"
  on public.disputes
  for insert
  to authenticated
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5C. creator_payouts RLS
-- ---------------------------------------------------------------------------

drop policy if exists "creator_payouts: creator can read own" on public.creator_payouts;
create policy "creator_payouts: creator can read own"
  on public.creator_payouts
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.creator_profiles cp
      where cp.id = creator_payouts.creator_id
        and cp.user_id = public.current_profile_id()
        and cp.deleted_at is null
    )
  );

drop policy if exists "creator_payouts: admin can read all" on public.creator_payouts;
create policy "creator_payouts: admin can read all"
  on public.creator_payouts
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "creator_payouts: admin can insert" on public.creator_payouts;
create policy "creator_payouts: admin can insert"
  on public.creator_payouts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "creator_payouts: admin can update all" on public.creator_payouts;
create policy "creator_payouts: admin can update all"
  on public.creator_payouts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 6. Optional atomic helper: create payout row after successful paid order
--    This is safe to call from service-role/admin-side payment webhook flow.
-- ---------------------------------------------------------------------------

create or replace function public.create_creator_payout_for_order(
  p_order_id uuid
)
returns public.creator_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_payout public.creator_payouts%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Payout can only be created for paid orders';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
    and status = 'paid'
    and deleted_at is null
  order by created_at desc
  limit 1;

  insert into public.creator_payouts (
    creator_id,
    order_id,
    payment_id,
    amount,
    currency,
    status,
    provider
  )
  values (
    v_order.creator_id,
    v_order.id,
    case when v_payment.id is null then null else v_payment.id end,
    v_order.seller_amount,
    v_order.currency,
    'pending',
    'manual'
  )
  on conflict do nothing;

  select *
  into v_payout
  from public.creator_payouts
  where order_id = p_order_id
    and deleted_at is null
  order by created_at desc
  limit 1;

  if v_payout.id is null then
    raise exception 'Failed to create or fetch payout';
  end if;

  return v_payout;
end;
$$;


-- =============================================================================
-- End of migration 019_refunds_disputes_payouts.sql
-- =============================================================================