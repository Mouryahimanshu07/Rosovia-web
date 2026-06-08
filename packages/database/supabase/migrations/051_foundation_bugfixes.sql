-- =============================================================================
-- Rosovia Social Commerce: Foundation Bugfixes
-- Migration: 051_foundation_bugfixes.sql
-- Purpose: Fixes creator_posts RLS insert policies for instant publish,
--          redefines public view for privacy protection, and ensures follow constraints.
-- =============================================================================

-- 1. Redefine creator_posts insert RLS to allow moderation_status = 'approved'
DROP POLICY IF EXISTS "creator_posts: owner can insert" ON public.creator_posts;
CREATE POLICY "creator_posts: owner can insert"
  ON public.creator_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = creator_posts.creator_profile_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND cp.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
    AND creator_posts.moderation_status = 'approved'
  );

-- 2. Keep creator post visibility public only when approved (re-enforce)
DROP POLICY IF EXISTS "creator_posts: public can read approved public" ON public.creator_posts;
CREATE POLICY "creator_posts: public can read approved public"
  ON public.creator_posts
  FOR SELECT
  USING (
    visibility = 'public'
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
  );

-- 3. Ensure creators can update only their own posts and cannot bypass moderation
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

-- 4. Ensure creators can delete only their own posts
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

-- 5. Ensure unique follow constraints/indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS profile_follows_unique_idx
  ON public.profile_follows (follower_profile_id, following_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS creator_follows_unique_idx
  ON public.creator_follows (follower_profile_id, creator_profile_id);

-- 6. Create safe public profile view: public_profiles
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
  created_at,
  updated_at
FROM public.profiles
WHERE status = 'active'
  AND deleted_at IS NULL;

-- 7. Grant public permissions on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;
