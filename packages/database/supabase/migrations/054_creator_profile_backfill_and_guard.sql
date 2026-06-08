-- =============================================================================
-- Rosovia Creator Profile Backfill and Guard
-- Migration: 054_creator_profile_backfill_and_guard.sql
-- Description: Ensures every creator profile row is backfilled and sets up
--              a trigger to auto-create and synchronize creator profiles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper Function: generate_unique_creator_slug
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_unique_creator_slug(
  p_username text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL
) RETURNS text
language plpgsql
security definer
as $$
DECLARE
  v_base text;
  v_slug text;
  v_counter integer := 1;
  v_exists boolean;
BEGIN
  -- Priority 1: Use username if available
  IF p_username IS NOT NULL AND p_username <> '' THEN
    v_base := lower(regexp_replace(p_username, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Trim leading/trailing hyphens
    v_base := trim(both '-' from v_base);
  END IF;

  -- Priority 2: Fallback to creator- + short uuid
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'creator-' || left(p_profile_id::text, 8);
  END IF;

  v_slug := v_base;

  -- Loop to check uniqueness
  LOOP
    SELECT exists(SELECT 1 FROM public.creator_profiles WHERE slug = v_slug) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_slug;
    END IF;
    
    v_counter := v_counter + 1;
    -- If loop runs too long, add a random suffix instead
    IF v_counter > 10 THEN
      RETURN v_base || '-' || substring(md5(random()::text) from 1 for 4);
    ELSE
      v_slug := v_base || '-' || v_counter;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Backfill existing active creators without creator_profiles
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Trigger Function: trg_profiles_ensure_creator_profile
--    Ensures creator_profiles row exists and keeps basic fields synchronized.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_profiles_ensure_creator_profile()
RETURNS trigger AS $$
DECLARE
  v_slug text;
  v_display_name text;
BEGIN
  IF NEW.role = 'creator' AND NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
    -- Check if creator_profiles exists
    IF NOT EXISTS (
      SELECT 1 FROM public.creator_profiles WHERE user_id = NEW.id
    ) THEN
      v_slug := public.generate_unique_creator_slug(NEW.username, NEW.id);
      v_display_name := COALESCE(NEW.full_name, NEW.username, 'Creator');
      
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
        NEW.id,
        v_display_name,
        v_slug,
        NEW.bio,
        NEW.city,
        NEW.state,
        NEW.country,
        NEW.avatar_url,
        NEW.cover_image_url,
        now(),
        now()
      );
    ELSE
      -- Sync profiles updates to creator_profiles if display details changed
      UPDATE public.creator_profiles
      SET
        display_name = COALESCE(NEW.full_name, NEW.username, display_name),
        bio = COALESCE(NEW.bio, bio),
        city = COALESCE(NEW.city, city),
        state = COALESCE(NEW.state, state),
        country = COALESCE(NEW.country, country),
        profile_image_url = COALESCE(NEW.avatar_url, profile_image_url),
        cover_image_url = COALESCE(NEW.cover_image_url, cover_image_url),
        updated_at = now()
      WHERE user_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. Create trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS ensure_creator_profile_on_role_change ON public.profiles;
CREATE TRIGGER ensure_creator_profile_on_role_change
  AFTER INSERT OR UPDATE OF role, status, deleted_at, username, full_name, bio, city, state, country, avatar_url, cover_image_url
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_ensure_creator_profile();
