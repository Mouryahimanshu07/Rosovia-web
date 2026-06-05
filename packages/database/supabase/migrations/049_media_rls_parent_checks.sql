-- Migration 049: Media RLS parent checks
-- Purpose: Redefine media_assets select policy so listing/post media only appear when the parent listing/post is approved.

-- 1. Drop existing public read policy
DROP POLICY IF EXISTS "media_assets: public can read approved public media" ON public.media_assets;

-- 2. Create the new policy checking parent statuses
CREATE POLICY "media_assets: public can read approved public media"
  ON public.media_assets
  FOR SELECT
  USING (
    is_private = false
    AND status = 'approved'
    AND deleted_at IS NULL
    AND (
      -- Check listing if associated
      (listing_id IS NULL OR EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = media_assets.listing_id
          AND l.status = 'approved'
          AND l.deleted_at IS NULL
      ))
      AND
      -- Check post if associated
      (NOT EXISTS (
        SELECT 1 FROM public.creator_post_media cpm
        WHERE cpm.media_asset_id = media_assets.id
      ) OR EXISTS (
        SELECT 1 FROM public.creator_post_media cpm
        JOIN public.creator_posts cp ON cp.id = cpm.post_id
        WHERE cpm.media_asset_id = media_assets.id
          AND cp.visibility = 'public'
          AND cp.moderation_status = 'approved'
          AND cp.deleted_at IS NULL
      ))
    )
  );
