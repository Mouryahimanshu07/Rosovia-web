-- =============================================================================
-- Rosovia Explore Profile Discovery Fix
-- Migration: 058_explore_profile_discovery_fix.sql
-- Description: Backfills missing creator profiles and ensures public_profiles
--              view is fully synchronized.
-- =============================================================================

-- Backfill existing active creators without creator_profiles
DO $$
DECLARE
  r record;
  v_slug text;
  v_display_name text;
BEGIN
  FOR r IN 
    SELECT p.id, p.full_name, p.username, p.bio, p.city, p.state, p.country, p.avatar_url, p.cover_image_url
    FROM public.profiles p
    LEFT JOIN public.creator_profiles cp ON cp.user_id = p.id
    WHERE p.role = 'creator'
      AND p.deleted_at IS NULL
      AND p.status = 'active'
      AND cp.id IS NULL
  LOOP
    v_slug := public.generate_unique_creator_slug(r.username, r.id);
    v_display_name := COALESCE(r.full_name, r.username, 'Creator');

    INSERT INTO public.creator_profiles (
      user_id,
      display_name,
      slug,
      bio,
      city,
      state,
      country,
      profile_image_url,
      cover_image_url,
      created_at,
      updated_at
    ) VALUES (
      r.id,
      v_display_name,
      v_slug,
      r.bio,
      r.city,
      r.state,
      r.country,
      r.avatar_url,
      r.cover_image_url,
      now(),
      now()
    );
  END LOOP;
END;
$$;
