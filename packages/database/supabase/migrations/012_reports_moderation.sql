-- =============================================================================
-- Rosovia Module 14: Reports and Moderation
-- Migration: 012_reports_moderation.sql
-- Depends on: 001_foundation.sql (set_updated_at, is_admin, profiles),
--             003_listings.sql (listings),
--             004_media_assets.sql (media_assets),
--             006_inquiries.sql (inquiries),
--             010_reviews.sql (reviews)
-- Purpose: Creates public.reports and public.admin_actions tables.
--          reports: user-submitted reports on creators, listings, reviews, etc.
--          admin_actions: immutable audit log of all admin moderation decisions.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.reports
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id            uuid          primary key default gen_random_uuid(),
  reporter_id   uuid          not null references public.profiles(id) on delete cascade,
  target_type   text          not null,
  target_id     uuid          not null,
  reason        text          not null,
  description   text          null,
  status        text          not null default 'pending',
  admin_note    text          null,
  reviewed_by   uuid          null references public.profiles(id) on delete set null,
  reviewed_at   timestamptz   null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  deleted_at    timestamptz   null,

  -- target_type must be a supported content type
  constraint reports_target_type_check check (
    target_type in ('creator', 'listing', 'review', 'inquiry', 'user')
  ),

  -- status must be a valid lifecycle state
  constraint reports_status_check check (
    status in ('pending', 'reviewed', 'resolved', 'rejected')
  ),

  -- reason must be a recognized category
  constraint reports_reason_check check (
    reason in (
      'spam',
      'scam',
      'harassment',
      'inappropriate_content',
      'fake_profile',
      'misleading_listing',
      'payment_issue',
      'abusive_review',
      'other'
    )
  ),

  -- description max length
  constraint reports_description_length_check check (
    description is null or char_length(description) <= 2000
  ),

  -- admin_note max length
  constraint reports_admin_note_length_check check (
    admin_note is null or char_length(admin_note) <= 2000
  )
);


-- ---------------------------------------------------------------------------
-- 2. updated_at trigger for reports
-- ---------------------------------------------------------------------------

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 3. Indexes for reports
-- ---------------------------------------------------------------------------

create index if not exists reports_reporter_id_idx
  on public.reports(reporter_id);

create index if not exists reports_target_type_idx
  on public.reports(target_type);

create index if not exists reports_target_id_idx
  on public.reports(target_id);

create index if not exists reports_status_idx
  on public.reports(status);

create index if not exists reports_reviewed_by_idx
  on public.reports(reviewed_by);

create index if not exists reports_created_at_idx
  on public.reports(created_at);

-- Compound indexes for common admin query patterns
create index if not exists reports_target_idx
  on public.reports(target_type, target_id);

create index if not exists reports_status_created_at_idx
  on public.reports(status, created_at);


-- ---------------------------------------------------------------------------
-- 4. Row Level Security for reports
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;


-- 4a. Authenticated users can INSERT their own report
--     Enforces: reporter_id = own profile, profile active, status pending,
--     admin fields null, deleted_at null.
--     NOTE: Target existence and self-report prevention are enforced in service layer.
drop policy if exists "reports: authenticated user can insert own" on public.reports;
create policy "reports: authenticated user can insert own"
  on public.reports
  for insert
  to authenticated
  with check (
    -- reporter_id must match the current user's active profile
    exists (
      select 1 from public.profiles p
      where p.id = reports.reporter_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    -- status must be pending on insert
    and reports.status = 'pending'
    -- admin-only fields must be null on insert
    and reports.reviewed_by is null
    and reports.reviewed_at is null
    and reports.admin_note is null
    -- deleted_at must be null on insert
    and reports.deleted_at is null
  );


-- 4b. Users can SELECT their own reports (non-deleted)
drop policy if exists "reports: user can read own" on public.reports;
create policy "reports: user can read own"
  on public.reports
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = reports.reporter_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- 4c. Admin can SELECT all reports
drop policy if exists "reports: admin can read all" on public.reports;
create policy "reports: admin can read all"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());


-- 4d. Admin can UPDATE reports (status, admin_note, reviewed_by, reviewed_at)
drop policy if exists "reports: admin can update" on public.reports;
create policy "reports: admin can update"
  on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- NOTE: No user UPDATE policy is created in Module 14.
--       Normal users cannot modify their own reports after submission.


-- ---------------------------------------------------------------------------
-- 5. Table: public.admin_actions
--    Immutable audit log — admin rows are never updated or deleted.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_actions (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        null references public.profiles(id) on delete set null,
  action_type text        not null,
  target_type text        not null,
  target_id   uuid        not null,
  note        text        null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  -- action_type must be a recognized admin operation
  constraint admin_actions_action_type_check check (
    action_type in (
      'report_reviewed',
      'report_resolved',
      'report_rejected',
      'review_hidden',
      'review_unhidden',
      'listing_suspended',
      'listing_unsuspended',
      'user_suspended',
      'user_unsuspended',
      'creator_suspended',
      'creator_unsuspended',
      'verification_reviewed',
      'manual_note'
    )
  ),

  -- target_type must be a recognized entity
  constraint admin_actions_target_type_check check (
    target_type in (
      'report',
      'creator',
      'listing',
      'review',
      'user',
      'verification_request',
      'order',
      'payment'
    )
  ),

  -- note max length
  constraint admin_actions_note_length_check check (
    note is null or char_length(note) <= 2000
  )
);


-- ---------------------------------------------------------------------------
-- 6. Indexes for admin_actions
-- ---------------------------------------------------------------------------

create index if not exists admin_actions_admin_id_idx
  on public.admin_actions(admin_id);

create index if not exists admin_actions_action_type_idx
  on public.admin_actions(action_type);

create index if not exists admin_actions_target_idx
  on public.admin_actions(target_type, target_id);

create index if not exists admin_actions_created_at_idx
  on public.admin_actions(created_at);


-- ---------------------------------------------------------------------------
-- 7. Row Level Security for admin_actions
-- ---------------------------------------------------------------------------

alter table public.admin_actions enable row level security;


-- 7a. Admin can SELECT all admin_actions
drop policy if exists "admin_actions: admin can read all" on public.admin_actions;
create policy "admin_actions: admin can read all"
  on public.admin_actions
  for select
  to authenticated
  using (public.is_admin());


-- 7b. Admin can INSERT admin_actions
drop policy if exists "admin_actions: admin can insert" on public.admin_actions;
create policy "admin_actions: admin can insert"
  on public.admin_actions
  for insert
  to authenticated
  with check (public.is_admin());


-- NOTE: No UPDATE or DELETE policy for admin_actions.
--       admin_actions is an immutable audit log.
-- NOTE: No SELECT or INSERT policy for normal authenticated users.
--       Normal users have no access to admin_actions.

-- =============================================================================
-- End of migration 012_reports_moderation.sql
-- =============================================================================
