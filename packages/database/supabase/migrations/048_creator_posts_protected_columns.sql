-- Migration 048: Creator posts protected columns trigger
-- Purpose: Prevent regular authenticated users (non-admins) from updating protected fields on creator_posts.

CREATE OR REPLACE FUNCTION public.check_post_protected_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to authenticated users, bypass for service_role/postgres
  IF auth.role() = 'authenticated' THEN
    -- Check if user is an admin
    IF NOT public.is_admin() THEN
      -- Regular user check: Only allow updating safe fields. Block updates to the following:
      IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status OR
         NEW.like_count IS DISTINCT FROM OLD.like_count OR
         NEW.save_count IS DISTINCT FROM OLD.save_count OR
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

DROP TRIGGER IF EXISTS tr_check_post_protected_columns ON public.creator_posts;
CREATE TRIGGER tr_check_post_protected_columns
  BEFORE UPDATE ON public.creator_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_post_protected_columns();
