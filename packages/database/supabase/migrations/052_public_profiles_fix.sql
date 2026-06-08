-- =============================================================================
-- Rosovia Social Commerce: Public Profiles View Fix
-- Migration: 052_public_profiles_fix.sql
-- Purpose: Adds safe public fields (city, state, country, language) to the
--          public_profiles view so profile pages can display location info.
--          Does NOT expose: email, phone, auth_user_id, or internal flags.
-- =============================================================================

-- Recreate public_profiles view with additional safe fields
DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  username,
  full_name AS display_name,
  avatar_url,
  cover_image_url,
  bio,
  role,
  status,
  city,
  state,
  country,
  language,
  created_at,
  updated_at
FROM public.profiles
WHERE status = 'active'
  AND deleted_at IS NULL;

-- Grant public permissions on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;
