-- =============================================================================
-- Rosovia Custom Order Settings Columns
-- Migration: 056_custom_order_profile_settings.sql
-- Purpose: Add custom order settings columns to creator_profiles.
-- =============================================================================

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS accepts_custom_orders boolean default true,
  ADD COLUMN IF NOT EXISTS custom_order_description text null,
  ADD COLUMN IF NOT EXISTS custom_order_starting_price numeric null,
  ADD COLUMN IF NOT EXISTS custom_order_delivery_days integer null;

COMMENT ON COLUMN public.creator_profiles.accepts_custom_orders IS 'Whether the creator is currently accepting custom order requests';
COMMENT ON COLUMN public.creator_profiles.custom_order_description IS 'Custom order commission policy, accepted work description, or notes';
COMMENT ON COLUMN public.creator_profiles.custom_order_starting_price IS 'Starting price/budget for custom orders';
COMMENT ON COLUMN public.creator_profiles.custom_order_delivery_days IS 'Typical delivery time in days for custom orders';
