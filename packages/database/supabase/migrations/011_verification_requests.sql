-- =============================================================================
-- Rosovia Module 13: Verification
-- Migration: 011_verification_requests.sql
-- Depends on: 001_foundation.sql (set_updated_at, is_admin, profiles),
--             002_creator_profiles.sql (creator_profiles),
--             004_media_assets.sql (media_assets)
-- Purpose: Creates public.verification_requests table for creator identity and
--          business verification. Includes RLS policies for creator submit and
--          admin review. Admin approval updates creator_profiles via service layer.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.verification_requests
-- ---------------------------------------------------------------------------

create table if not exists public.verification_requests (
  id                  uuid          primary key default gen_random_uuid(),
  user_id             uuid          not null references public.profiles(id) on delete cascade,
  creator_id          uuid          null references public.creator_profiles(id) on delete cascade,
  verification_type   text          not null,
  requested_level     text          not null,
  document_type       text          not null,
  document_media_id   uuid          not null references public.media_assets(id) on delete restrict,
  status              text          not null default 'pending',
  admin_note          text          null,
  reviewed_by         uuid          null references public.profiles(id) on delete set null,
  reviewed_at         timestamptz   null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  deleted_at          timestamptz   null,

  -- verification_type must be one of the supported types
  constraint verification_requests_type_check check (
    verification_type in ('creator', 'seller', 'mentor', 'business')
  ),

  -- requested_level — trusted_seller is NOT allowed from public request flow
  constraint verification_requests_level_check check (
    requested_level in ('basic_verified', 'creator_verified', 'seller_verified')
  ),

  -- status must be a valid lifecycle state
  constraint verification_requests_status_check check (
    status in ('pending', 'approved', 'rejected')
  ),

  -- document_type must be a recognized category
  constraint verification_requests_document_type_check check (
    document_type in ('identity', 'business', 'portfolio', 'address', 'certificate', 'other')
  ),

  -- admin_note max length
  constraint verification_requests_admin_note_length_check check (
    admin_note is null or char_length(admin_note) <= 2000
  )
);


-- ---------------------------------------------------------------------------
-- 2. One active pending request per user per verification type
--    Partial unique index: only enforced when status = 'pending' and not deleted
-- ---------------------------------------------------------------------------

create unique index if not exists verification_requests_one_pending_per_type_idx
  on public.verification_requests(user_id, verification_type)
  where status = 'pending' and deleted_at is null;


-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists set_verification_requests_updated_at on public.verification_requests;
create trigger set_verification_requests_updated_at
  before update on public.verification_requests
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

create index if not exists verification_requests_user_id_idx
  on public.verification_requests(user_id);

create index if not exists verification_requests_creator_id_idx
  on public.verification_requests(creator_id);

create index if not exists verification_requests_document_media_id_idx
  on public.verification_requests(document_media_id);

create index if not exists verification_requests_status_idx
  on public.verification_requests(status);

create index if not exists verification_requests_verification_type_idx
  on public.verification_requests(verification_type);

create index if not exists verification_requests_reviewed_by_idx
  on public.verification_requests(reviewed_by);

create index if not exists verification_requests_created_at_idx
  on public.verification_requests(created_at);


-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.verification_requests enable row level security;


-- ---------------------------------------------------------------------------
-- 5a. User can read own verification requests
-- ---------------------------------------------------------------------------
drop policy if exists "verification_requests: user can read own" on public.verification_requests;
create policy "verification_requests: user can read own"
  on public.verification_requests
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = verification_requests.user_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );


-- ---------------------------------------------------------------------------
-- 5b. Creator can insert own verification request
--     Enforces: user_id is own profile, profile is active creator,
--               status must be pending, reviewed_by/reviewed_at/admin_note
--               must be null, requested_level cannot be trusted_seller.
--
--     NOTE: Full media validation (is_private, media_type, owner) is done
--     in the service layer (review.service.ts) because RLS cannot safely
--     join to media_assets and check is_private without recursion risk.
--     This is consistent with how orders and payments handle complex checks.
-- ---------------------------------------------------------------------------
drop policy if exists "verification_requests: creator can insert" on public.verification_requests;
create policy "verification_requests: creator can insert"
  on public.verification_requests
  for insert
  to authenticated
  with check (
    -- user_id must be current authenticated user's active creator profile
    exists (
      select 1 from public.profiles p
      where p.id = verification_requests.user_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.role = 'creator'
        and p.deleted_at is null
    )
    -- status must be pending on insert
    and verification_requests.status = 'pending'
    -- admin fields must be null on creator insert
    and verification_requests.reviewed_by is null
    and verification_requests.reviewed_at is null
    and verification_requests.admin_note is null
    -- deleted_at must be null on insert
    and verification_requests.deleted_at is null
    -- requested_level cannot be trusted_seller
    and verification_requests.requested_level <> 'trusted_seller'
  );


-- ---------------------------------------------------------------------------
-- 5c. Normal users cannot UPDATE their own verification requests
--     (cancellation and resubmission will be added in a later module)
-- ---------------------------------------------------------------------------
-- No user UPDATE policy is created in Module 13.


-- ---------------------------------------------------------------------------
-- 5d. Admin can read all verification requests (including deleted)
-- ---------------------------------------------------------------------------
drop policy if exists "verification_requests: admin can read all" on public.verification_requests;
create policy "verification_requests: admin can read all"
  on public.verification_requests
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5e. Admin can update verification requests
--     Admin can set: status, admin_note, reviewed_by, reviewed_at.
--     Creator profile update after approval is handled in the service layer.
-- ---------------------------------------------------------------------------
drop policy if exists "verification_requests: admin can update" on public.verification_requests;
create policy "verification_requests: admin can update"
  on public.verification_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- NOTE: Public SELECT policy is intentionally omitted.
-- Verification requests are private — only the requesting user and admin
-- should see them. Documents are private media assets and are never exposed
-- via public URLs.
--
-- NOTE: The INSERT RLS policy cannot fully verify media ownership, is_private,
-- and media_type in a single policy without joins that risk recursion.
-- The service layer (verification.service.ts) is the primary enforcement point
-- for media validation. This is documented in docs/verification.md.
-- ---------------------------------------------------------------------------
