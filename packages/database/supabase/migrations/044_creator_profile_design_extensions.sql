-- =============================================================================
-- Rosovia Creator Profile Design Extensions
-- Migration: 044_creator_profile_design_extensions.sql
-- Purpose: Add safe cover image, headline, website, and theme fields to creator_profiles.
-- =============================================================================

alter table public.creator_profiles
  add column if not exists cover_image_url text null,
  add column if not exists headline text null,
  add column if not exists website_url text null,
  add column if not exists profile_theme text null default 'default';

comment on column public.creator_profiles.cover_image_url is 'Safe public cover/banner image URL';
comment on column public.creator_profiles.headline is 'Short professional headline or tagline';
comment on column public.creator_profiles.website_url is 'Safe external links/website portfolio URL';
comment on column public.creator_profiles.profile_theme is 'Custom CSS visual theme selection';
