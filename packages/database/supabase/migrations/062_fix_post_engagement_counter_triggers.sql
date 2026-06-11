-- Migration 062: Fix post engagement counter triggers
-- Purpose: Allow internal database triggers (nested updates) to modify protected columns
-- (like_count, save_count, comment_count) while keeping them blocked for direct user updates.

CREATE OR REPLACE FUNCTION public.check_post_protected_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to authenticated users, bypass for service_role/postgres
  IF auth.role() = 'authenticated' THEN
    -- Check if user is an admin
    IF NOT public.is_admin() THEN
      -- Bypass check if the update is nested/called from another trigger (e.g. likes/saves/comments counters)
      IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
      END IF;

      -- Regular user check: Only allow updating safe fields. Block direct updates to the following:
      IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status OR
         NEW.like_count IS DISTINCT FROM OLD.like_count OR
         NEW.save_count IS DISTINCT FROM OLD.save_count OR
         NEW.comment_count IS DISTINCT FROM OLD.comment_count OR
         NEW.view_count IS DISTINCT FROM OLD.view_count OR
         NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id OR
         NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'You are not allowed to update protected post fields.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
