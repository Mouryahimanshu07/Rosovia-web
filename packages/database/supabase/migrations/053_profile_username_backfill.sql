-- =============================================================================
-- Rosovia Social Commerce: Profile Username Backfill & Triggers
-- Migration: 053_profile_username_backfill.sql
-- Purpose: Ensures all users (existing and future) have a unique username.
--          1. Helper function generate_unique_username() with prioritized logic.
--          2. Backfills all profiles with null/empty usernames.
--          3. Adds a BEFORE INSERT/UPDATE trigger to guarantee username generation.
-- =============================================================================

-- 1. Helper function to generate unique username
CREATE OR REPLACE FUNCTION public.generate_unique_username(
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_username text;
  v_candidate_username text;
  v_exists boolean;
  v_counter integer := 0;
  v_random_suffix text;
BEGIN
  -- Priority 1: full_name (lowercase, replace spaces, strip non-alphanumeric/underscore/hyphen, limit length)
  IF p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
    v_base_username := lower(trim(p_full_name));
    v_base_username := regexp_replace(v_base_username, '\s+', '_', 'g');
    v_base_username := regexp_replace(v_base_username, '[^a-z0-9_\-]', '', 'g');
    v_base_username := left(v_base_username, 24);
  END IF;

  -- Priority 2: email prefix (if base is still empty)
  IF (v_base_username IS NULL OR v_base_username = '') AND p_email IS NOT NULL AND trim(p_email) <> '' THEN
    v_base_username := lower(split_part(p_email, '@', 1));
    v_base_username := regexp_replace(v_base_username, '\s+', '_', 'g');
    v_base_username := regexp_replace(v_base_username, '[^a-z0-9_\-]', '', 'g');
    v_base_username := left(v_base_username, 24);
  END IF;

  -- Priority 3: 'user-' + left(id, 8) (if base is still empty)
  IF v_base_username IS NULL OR v_base_username = '' THEN
    IF p_profile_id IS NOT NULL THEN
      v_base_username := 'user-' || left(p_profile_id::text, 8);
    ELSE
      v_base_username := 'user-' || left(gen_random_uuid()::text, 8);
    END IF;
  END IF;

  -- Ensure we don't have an empty string
  IF v_base_username IS NULL OR v_base_username = '' THEN
    v_base_username := 'user-' || left(gen_random_uuid()::text, 8);
  END IF;

  -- Uniqueness loop: check collision against profiles table
  v_candidate_username := v_base_username;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE username = v_candidate_username AND deleted_at IS NULL
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_candidate_username;
    END IF;

    v_counter := v_counter + 1;
    IF v_counter >= 10 THEN
      -- If we collide too many times, append a random UUID prefix to avoid infinite loop
      RETURN left(v_base_username, 19) || '-' || left(gen_random_uuid()::text, 4);
    END IF;

    -- Append '-' + a random 4-char hex suffix
    v_random_suffix := substring(md5(random()::text) from 1 for 4);
    v_candidate_username := left(v_base_username, 19) || '-' || v_random_suffix;
  END LOOP;
END;
$$;

-- 2. Backfill existing profiles with NULL or empty username
UPDATE public.profiles
SET username = public.generate_unique_username(full_name, email, id)
WHERE (username IS NULL OR username = '')
  AND deleted_at IS NULL;

-- 3. Create BEFORE INSERT or UPDATE trigger function to guarantee usernames
CREATE OR REPLACE FUNCTION public.trg_profiles_ensure_username()
RETURNS trigger AS $$
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := public.generate_unique_username(NEW.full_name, NEW.email, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS ensure_username_on_insert ON public.profiles;
CREATE TRIGGER ensure_username_on_insert
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_ensure_username();
