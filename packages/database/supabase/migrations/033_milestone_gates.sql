-- =============================================================================
-- Rosovia Module: Milestone Gates & Growth Strategy Enhancements
-- Migration: 033_milestone_gates.sql
-- Depends on: 008_orders.sql
-- =============================================================================

-- Add metadata column to public.orders if it doesn't exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
