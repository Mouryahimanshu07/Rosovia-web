-- =============================================================================
-- Rosovia Module 15 Cleanup: Admin Actions Category Target Type
-- Migration: 014_admin_actions_category_target.sql
-- Depends on: 012_reports_moderation.sql (admin_actions table + target_type constraint)
-- Purpose:
--   Extend admin_actions_target_type_check to include 'category'.
--   Required because category_created and category_updated admin actions
--   correctly log against the category entity, not listings.
--   No new tables. No destructive changes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extend admin_actions target_type constraint to include 'category'
-- ---------------------------------------------------------------------------

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
      'payment'
    )
  );


-- =============================================================================
-- End of migration 014_admin_actions_category_target.sql
-- =============================================================================
