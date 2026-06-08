-- Migration 055: Creator post delete RLS fix
-- Purpose: Fix RLS policies on creator_posts to allow creators to soft-delete
--          their own posts without encountering "new row violates row-level security policy".
--          This is achieved by allowing the owner to SELECT/read their own soft-deleted
--          posts (i.e. removing 'and deleted_at is null' from the SELECT policy USING clause).

-- 1. Ensure deleted_at column exists
ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- 2. Create optimized index for active public posts
CREATE INDEX IF NOT EXISTS idx_creator_posts_public_visible
  ON public.creator_posts (creator_profile_id, moderation_status, created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Recreate policies for creator_posts owner access
DROP POLICY IF EXISTS "creator_posts: owner can read own" ON public.creator_posts;
CREATE POLICY "creator_posts: owner can read own"
  ON public.creator_posts
  FOR SELECT
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
  );

DROP POLICY IF EXISTS "creator_posts: owner can update safe fields" ON public.creator_posts;
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
    AND moderation_status = 'approved'
  );

DROP POLICY IF EXISTS "creator_posts: owner can delete" ON public.creator_posts;
CREATE POLICY "creator_posts: owner can delete"
  ON public.creator_posts
  FOR DELETE
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
  );
