-- Migration: 036_profiles_public_select_policy.sql
-- Description: Add a public read policy to the profiles table to allow reading basic status/role columns for active accounts.
-- This ensures that anonymous and authenticated users can search and discover active creators, whose profiles are inner joined in searches.

DROP POLICY IF EXISTS "profiles: public can read active profiles" ON public.profiles;

CREATE POLICY "profiles: public can read active profiles"
ON public.profiles
FOR SELECT
TO public
USING (status = 'active' AND deleted_at IS NULL);
