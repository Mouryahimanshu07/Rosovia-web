-- Migration 068: Creator system RLS fixes
-- Purpose:
-- 1. Refine SELECT policy for media_assets to allow visitors to view approved/ready/uploaded media assets.
-- 2. Refine INSERT policy for media_assets to allow creator owners to insert media assets with status 'approved' directly.
-- 3. Refine UPDATE policy for listings to allow creator owners to update approved listings without RLS blocking them (by keeping status approved if already approved).

-- 1. Drop existing policies to be updated
DROP POLICY IF EXISTS "media_assets: public can read approved public media" ON public.media_assets;
DROP POLICY IF EXISTS "media_assets: owner can insert own" ON public.media_assets;
DROP POLICY IF EXISTS "listings: creator can update own" ON public.listings;

-- 2. Create refined SELECT policy for public media assets
-- Allow public select if the media is not private, status is approved/ready/uploaded, and it satisfies the parent listing/post checks if they are attached.
CREATE POLICY "media_assets: public can read approved public media"
  ON public.media_assets
  FOR SELECT
  USING (
    is_private = false
    AND status IN ('uploaded', 'ready', 'approved')
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

-- 3. Create refined INSERT policy for media assets
-- Allow creators to insert assets with status 'uploaded', 'processing', or 'approved' (since the API stamps them as approved directly).
CREATE POLICY "media_assets: owner can insert own"
  ON public.media_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = owner_id
        AND p.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND status IN ('uploaded', 'processing', 'approved')
  );

-- 4. Create refined UPDATE policy for listings
-- Allow creator to update own listing, and keep the status as approved if it was already approved, preventing self-escalation.
CREATE POLICY "listings: creator can update own"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = listings.creator_id
        and p.auth_user_id = auth.uid()
        and p.role = 'creator'
        and p.status = 'active'
        and p.deleted_at is null
    )
  )
  WITH CHECK (
    -- still own the listing after update (prevent creator_id transfer)
    EXISTS (
      SELECT 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = creator_id
        and p.auth_user_id = auth.uid()
        and p.role = 'creator'
        and p.status = 'active'
        and p.deleted_at is null
    )
    -- cannot self-escalate to approved unless it was already approved
    AND (
      status IN ('draft', 'pending_review', 'archived')
      OR (listings.status = 'approved' AND status = 'approved')
    )
    -- cannot self-verify
    AND verification_status IN ('unverified', 'pending')
  );
