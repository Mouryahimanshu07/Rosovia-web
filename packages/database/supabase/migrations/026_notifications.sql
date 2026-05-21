-- =============================================================================
-- Rosovia Module: Notifications Foundation
-- Migration: 026_notifications.sql
-- Depends on: 001_foundation.sql (set_updated_at, is_admin, profiles)
-- Purpose: Creates public.notifications table for in-app notification delivery.
--          Covers order, payment, review, message, verification, and admin events.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id                    uuid        primary key default gen_random_uuid(),
  recipient_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  type                  text        not null,
  title                 text        not null,
  body                  text        null,
  entity_type           text        null,
  entity_id             uuid        null,
  read_at               timestamptz null,
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz null,

  -- type must be a recognized notification event
  constraint notifications_type_check check (
    type in (
      'order_created',
      'order_status_changed',
      'payment_received',
      'refund_requested',
      'dispute_opened',
      'message_received',
      'review_received',
      'verification_updated',
      'admin_action'
    )
  ),

  -- entity_type must be a recognized entity kind when provided
  constraint notifications_entity_type_check check (
    entity_type is null or entity_type in (
      'order',
      'payment',
      'refund',
      'dispute',
      'conversation',
      'review',
      'verification_request',
      'listing',
      'creator',
      'user'
    )
  ),

  -- title max length
  constraint notifications_title_length_check check (
    char_length(title) >= 1 and char_length(title) <= 500
  ),

  -- body max length
  constraint notifications_body_length_check check (
    body is null or char_length(body) <= 2000
  )
);


-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Primary lookup: fetch notifications for a user, newest first
create index if not exists notifications_recipient_profile_id_idx
  on public.notifications(recipient_profile_id);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications(recipient_profile_id, created_at desc);

-- Filter by type
create index if not exists notifications_type_idx
  on public.notifications(type);

-- Filter unread notifications for a user
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_profile_id)
  where read_at is null and deleted_at is null;

-- Entity lookup (e.g. "all notifications for order X")
create index if not exists notifications_entity_idx
  on public.notifications(entity_type, entity_id)
  where entity_type is not null;


-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;


-- 3a. Recipient can SELECT own non-deleted notifications
drop policy if exists "notifications: recipient can read own" on public.notifications;
create policy "notifications: recipient can read own"
  on public.notifications
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 3b. Recipient can UPDATE own notifications (mark as read)
drop policy if exists "notifications: recipient can update own" on public.notifications;
create policy "notifications: recipient can update own"
  on public.notifications
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 3c. Admin can SELECT all notifications
drop policy if exists "notifications: admin can read all" on public.notifications;
create policy "notifications: admin can read all"
  on public.notifications
  for select
  to authenticated
  using (public.is_admin());


-- 3d. Service-role INSERT policy
--     Notifications are inserted by server-side service functions using the
--     service-role Supabase client, which bypasses RLS. This policy allows
--     authenticated inserts as a safety net for edge cases.
drop policy if exists "notifications: service can insert" on public.notifications;
create policy "notifications: service can insert"
  on public.notifications
  for insert
  to authenticated
  with check (
    -- Only allow inserts where the recipient profile actually exists and is active
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.deleted_at is null
    )
  );


-- NOTE: No DELETE policy. Notifications are soft-deleted via deleted_at.
--       Only service-role or admin can soft-delete.

-- =============================================================================
-- End of migration 026_notifications.sql
-- =============================================================================
