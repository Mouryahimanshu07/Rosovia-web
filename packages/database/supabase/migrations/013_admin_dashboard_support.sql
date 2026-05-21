-- =============================================================================
-- Rosovia Module 15: Admin Dashboard Support
-- Migration: 013_admin_dashboard_support.sql
-- Depends on: 012_reports_moderation.sql (admin_actions table + constraint)
-- Purpose:
--   1. Extend admin_actions_action_type_check constraint with new action types
--      needed by the admin dashboard moderation features.
--   2. Add performance indexes for admin dashboard queries.
--   No new tables are created. No destructive changes to existing tables.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Extend admin_actions action_type constraint
--    Drop and recreate the check constraint to add new values.
--    Existing rows are unaffected — constraint only applies to new inserts.
-- ---------------------------------------------------------------------------

alter table public.admin_actions
  drop constraint if exists admin_actions_action_type_check;

alter table public.admin_actions
  add constraint admin_actions_action_type_check check (
    action_type in (
      -- Report moderation (Module 14)
      'report_reviewed',
      'report_resolved',
      'report_rejected',
      -- Review moderation (Module 14 + 15)
      'review_hidden',
      'review_unhidden',
      -- Listing moderation (Module 14 + 15)
      'listing_suspended',
      'listing_unsuspended',
      'listing_approved',
      'listing_rejected',
      -- User/creator moderation
      'user_suspended',
      'user_unsuspended',
      'creator_suspended',
      'creator_unsuspended',
      -- Verification (Module 13)
      'verification_reviewed',
      -- Category management (Module 15)
      'category_created',
      'category_updated',
      -- Generic
      'manual_note'
    )
  );


-- ---------------------------------------------------------------------------
-- 2. Performance indexes for admin dashboard queries
--    All are CREATE IF NOT EXISTS — safe to apply multiple times.
-- ---------------------------------------------------------------------------

-- profiles: admin lists users by status, role, created_at
create index if not exists profiles_status_idx
  on public.profiles(status);

create index if not exists profiles_role_idx
  on public.profiles(role);

create index if not exists profiles_created_at_idx
  on public.profiles(created_at);

-- creator_profiles: admin lists creators by verification_level, created_at
create index if not exists creator_profiles_verification_level_idx
  on public.creator_profiles(verification_level);

create index if not exists creator_profiles_created_at_idx
  on public.creator_profiles(created_at);

-- listings: admin moderation queries on status, listing_type
create index if not exists listings_status_idx
  on public.listings(status);

create index if not exists listings_listing_type_idx
  on public.listings(listing_type);

create index if not exists listings_creator_id_idx
  on public.listings(creator_id);

-- orders: admin overview by order_status, payment_status
create index if not exists orders_order_status_idx
  on public.orders(order_status);

create index if not exists orders_payment_status_idx
  on public.orders(payment_status);

create index if not exists orders_created_at_idx
  on public.orders(created_at);

-- payments: admin payment overview
create index if not exists payments_status_idx
  on public.payments(status);

create index if not exists payments_created_at_idx
  on public.payments(created_at);

-- reviews: admin moderation by is_hidden
create index if not exists reviews_is_hidden_idx
  on public.reviews(is_hidden);

create index if not exists reviews_created_at_idx
  on public.reviews(created_at);

-- verification_requests: admin by status
create index if not exists verification_requests_status_idx
  on public.verification_requests(status);

-- categories: admin list by is_active, priority
create index if not exists categories_is_active_idx
  on public.categories(is_active);

create index if not exists categories_priority_idx
  on public.categories(priority);


-- =============================================================================
-- End of migration 013_admin_dashboard_support.sql
-- =============================================================================
