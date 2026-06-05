-- =============================================================================
-- Rosovia Social Commerce Extensions
-- Migration: 043_social_commerce_extensions.sql
-- Purpose:
--   1. Add conversation_id to custom_orders (link conversation to structured order)
--   2. Add creator_reply / creator_replied_at to reviews (trust signal)
--   3. Extend notification type check constraint to include social notification types
--   4. Extend report target_type check to include 'post'
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. custom_orders — add conversation_id (nullable, safe)
-- ---------------------------------------------------------------------------
alter table public.custom_orders
  add column if not exists conversation_id uuid null references public.conversations(id) on delete set null;

create index if not exists custom_orders_conversation_id_idx on public.custom_orders(conversation_id);

-- ---------------------------------------------------------------------------
-- 2. reviews — add creator reply fields
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists creator_reply text null,
  add column if not exists creator_replied_at timestamptz null;

do $$
begin
  alter table public.reviews drop constraint if exists reviews_creator_reply_length_check;
exception when others then
  null;
end;
$$;

alter table public.reviews
  add constraint reviews_creator_reply_length_check
    check (creator_reply is null or char_length(creator_reply) <= 2000);

-- RLS: creator can update only creator_reply on own reviews
drop policy if exists "reviews: creator can add reply" on public.reviews;
create policy "reviews: creator can add reply"
  on public.reviews
  for update
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = reviews.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and is_hidden = false
    and deleted_at is null
  )
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = reviews.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 3. notifications — extend type constraint to include social types
--    Safe approach: drop old constraint and add new one with superset
-- ---------------------------------------------------------------------------

-- Drop the old check constraint on notifications.type (if name is known)
-- Use DO block for conditional safety
do $$
begin
  -- Attempt to drop the old check constraint; skip if it doesn't exist
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then
  null;
end;
$$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'order_created',
    'order_status_changed',
    'payment_received',
    'refund_requested',
    'dispute_opened',
    'message_received',
    'review_received',
    'verification_updated',
    'admin_action',
    'inquiry_received',
    'inquiry_replied',
    'custom_order_received',
    'custom_order_status_changed',
    -- Social commerce additions
    'new_follower',
    'post_approved',
    'post_rejected',
    'post_liked',
    'review_reply'
  ));

-- ---------------------------------------------------------------------------
-- 4. notifications — extend entity_type constraint
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.notifications drop constraint if exists notifications_entity_type_check;
exception when others then
  null;
end;
$$;

alter table public.notifications
  add constraint notifications_entity_type_check
  check (entity_type is null or entity_type in (
    'order',
    'payment',
    'refund',
    'dispute',
    'conversation',
    'review',
    'verification_request',
    'listing',
    'creator',
    'user',
    'inquiry',
    'custom_order',
    -- Social commerce additions
    'post',
    'follow'
  ));

-- ---------------------------------------------------------------------------
-- 5. reports — extend target_type constraint to include 'post'
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.reports drop constraint if exists reports_target_type_check;
exception when others then
  null;
end;
$$;

alter table public.reports
  add constraint reports_target_type_check
  check (target_type in (
    'creator',
    'listing',
    'review',
    'inquiry',
    'user',
    'post'
  ));
