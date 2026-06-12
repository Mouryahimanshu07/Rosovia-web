-- Migration 069: Rosovia Creator System Security and Architecture Fixes
-- Purpose:
-- 1. Refine the check_media_protected_columns trigger function on public.media_assets to:
--    - Allow the owner of a media asset to soft-delete their own assets (status = 'deleted', deleted_at = timestamp).
--    - Allow the owner of a media asset to update listing_id to associate it with a listing, provided the listing belongs to their creator profile.
-- 2. Refine the FOR UPDATE policy on public.creator_posts to allow creators to update/soft-delete their posts regardless of their current moderation status.

-- 1. Refine the protected media columns trigger function
CREATE OR REPLACE FUNCTION public.check_media_protected_columns()
RETURNS TRIGGER AS $$
DECLARE
  is_admin_user boolean;
  creator_profile_id uuid;
BEGIN
  -- Only apply to authenticated users, bypass for service_role/postgres
  IF auth.role() = 'authenticated' THEN
    is_admin_user := public.is_admin();
    IF NOT is_admin_user THEN
      -- Resolve the creator profile ID of the owner
      SELECT id INTO creator_profile_id 
      FROM public.creator_profiles 
      WHERE user_id = OLD.owner_id 
        AND deleted_at IS NULL;

      -- Check if any strictly protected columns are changing
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
         NEW.storage_provider IS DISTINCT FROM OLD.storage_provider OR
         NEW.storage_key IS DISTINCT FROM OLD.storage_key OR
         NEW.public_url IS DISTINCT FROM OLD.public_url OR
         NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
         NEW.mime_type IS DISTINCT FROM OLD.mime_type OR
         NEW.is_private IS DISTINCT FROM OLD.is_private THEN
        RAISE EXCEPTION 'You are not allowed to update protected media fields.';
      END IF;

      -- Check status update: regular user can only update status if it is changed to 'deleted'
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'deleted' THEN
        RAISE EXCEPTION 'You are not allowed to update protected media status.';
      END IF;

      -- Check deleted_at update: regular user can only update deleted_at if it becomes non-null (soft-delete)
      IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NULL THEN
        RAISE EXCEPTION 'You are not allowed to restore deleted media.';
      END IF;

      -- Check listing_id update: must own the listing
      IF NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN
        IF NEW.listing_id IS NOT NULL THEN
          -- Verify the listing belongs to the owner's creator profile
          IF NOT EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = NEW.listing_id
              AND l.creator_id = creator_profile_id
              AND l.deleted_at IS NULL
          ) THEN
            RAISE EXCEPTION 'Listing does not belong to your creator profile.';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Refine FOR UPDATE policy on creator_posts
-- Drop existing update policy
DROP POLICY IF EXISTS "creator_posts: owner can update safe fields" ON public.creator_posts;

-- Recreate update policy without 'AND moderation_status = 'approved'' check in WITH CHECK.
-- This allows creators to update or soft-delete their posts regardless of their current moderation status.
CREATE POLICY "creator_posts: owner can update safe fields"
  ON public.creator_posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = creator_posts.creator_profile_id
        AND p.auth_user_id = auth.uid()
        AND cp.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = creator_posts.creator_profile_id
        AND p.auth_user_id = auth.uid()
        AND cp.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
  );
