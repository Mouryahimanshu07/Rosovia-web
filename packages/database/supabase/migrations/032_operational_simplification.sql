-- =============================================================================
-- Rosovia Module: Operational Simplification Strategy
-- Migration: 032_operational_simplification.sql
-- Depends on:
--   002_creator_profiles.sql        -> creator_profiles
--   011_verification_requests.sql   -> verification_requests
--   012_reports_moderation.sql      -> reports
--   019_refunds_disputes_payouts.sql -> disputes
-- =============================================================================

-- 1. Auto-Verification Trigger for Creator Profiles
CREATE OR REPLACE FUNCTION public.auto_verify_creator_profile()
RETURNS TRIGGER AS $$
BEGIN
  NEW.verification_level := 'creator_verified';
  NEW.is_verified := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_verify_creator_profile ON public.creator_profiles;
CREATE TRIGGER trg_auto_verify_creator_profile
  BEFORE INSERT ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_creator_profile();

-- 2. Restrict public inserts to verification_requests
DROP POLICY IF EXISTS "verification_requests: creator can insert" ON public.verification_requests;
CREATE POLICY "verification_requests: creator can insert"
  ON public.verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Temporarily disabled for operational simplification

-- 3. Restrict public inserts to reports
DROP POLICY IF EXISTS "reports: authenticated user can insert own" ON public.reports;
CREATE POLICY "reports: authenticated user can insert own"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Temporarily disabled for operational simplification

-- 4. Restrict public inserts to disputes
DROP POLICY IF EXISTS "disputes: buyer or creator can insert own" ON public.disputes;
CREATE POLICY "disputes: buyer or creator can insert own"
  ON public.disputes
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Temporarily disabled for operational simplification
