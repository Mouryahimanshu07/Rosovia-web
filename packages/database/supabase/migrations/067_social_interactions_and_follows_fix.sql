-- Migration 067: Social interactions and follows RLS fixes
-- Purpose: Refine RLS policies for post_likes, post_saves, and creator_posts to support followers-only posts and owner engagement.

-- 1. Drop old and existing policies to ensure idempotency
DROP POLICY IF EXISTS "post_likes: public can select active" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: authenticated users can insert own if post is active" ON public.post_likes;
DROP POLICY IF EXISTS "post_saves: authenticated users can insert own if post is active" ON public.post_saves;
DROP POLICY IF EXISTS "creator_posts: followers can read approved followers-only" ON public.creator_posts;

-- Drop new policies if they already exist
DROP POLICY IF EXISTS "post_likes: select public active" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: select followers active" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: select own posts likes" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: select own likes" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: authenticated users can insert own" ON public.post_likes;
DROP POLICY IF EXISTS "post_saves: authenticated users can insert own" ON public.post_saves;

-- 2. New SELECT policies for post_likes
CREATE POLICY "post_likes: select public active"
  ON public.post_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_posts cp
      WHERE cp.id = post_likes.post_id
        AND cp.visibility = 'public'
        AND cp.moderation_status = 'approved'
        AND cp.deleted_at IS NULL
    )
  );

CREATE POLICY "post_likes: select followers active"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_posts cp
      JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
      JOIN public.profile_follows pf ON pf.following_profile_id = cpr.user_id
      JOIN public.profiles p ON p.id = pf.follower_profile_id
      WHERE cp.id = post_likes.post_id
        AND cp.visibility = 'followers'
        AND cp.moderation_status = 'approved'
        AND cp.deleted_at IS NULL
        AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "post_likes: select own posts likes"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_posts cp
      JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
      JOIN public.profiles p ON p.id = cpr.user_id
      WHERE cp.id = post_likes.post_id
        AND p.auth_user_id = auth.uid()
        AND cp.deleted_at IS NULL
    )
  );

CREATE POLICY "post_likes: select own likes"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = post_likes.profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- 3. New INSERT policy for post_likes
CREATE POLICY "post_likes: authenticated users can insert own"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    AND (
      -- Case 1: Post is public and approved
      EXISTS (
        SELECT 1 FROM public.creator_posts cp
        WHERE cp.id = post_id
          AND cp.visibility = 'public'
          AND cp.moderation_status = 'approved'
          AND cp.deleted_at IS NULL
      )
      -- Case 2: Post is followers-only and approved, and viewer follows creator
      OR EXISTS (
        SELECT 1 FROM public.creator_posts cp
        JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
        JOIN public.profile_follows pf ON pf.following_profile_id = cpr.user_id
        JOIN public.profiles p ON p.id = pf.follower_profile_id
        WHERE cp.id = post_id
          AND cp.visibility = 'followers'
          AND cp.moderation_status = 'approved'
          AND cp.deleted_at IS NULL
          AND p.auth_user_id = auth.uid()
      )
      -- Case 3: Post is owned by viewer
      OR EXISTS (
        SELECT 1 FROM public.creator_posts cp
        JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
        JOIN public.profiles p ON p.id = cpr.user_id
        WHERE cp.id = post_id
          AND p.auth_user_id = auth.uid()
          AND cp.deleted_at IS NULL
      )
    )
  );

-- 4. New INSERT policy for post_saves
CREATE POLICY "post_saves: authenticated users can insert own"
  ON public.post_saves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    AND (
      -- Case 1: Post is public and approved
      EXISTS (
        SELECT 1 FROM public.creator_posts cp
        WHERE cp.id = post_id
          AND cp.visibility = 'public'
          AND cp.moderation_status = 'approved'
          AND cp.deleted_at IS NULL
      )
      -- Case 2: Post is followers-only and approved, and viewer follows creator
      OR EXISTS (
        SELECT 1 FROM public.creator_posts cp
        JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
        JOIN public.profile_follows pf ON pf.following_profile_id = cpr.user_id
        JOIN public.profiles p ON p.id = pf.follower_profile_id
        WHERE cp.id = post_id
          AND cp.visibility = 'followers'
          AND cp.moderation_status = 'approved'
          AND cp.deleted_at IS NULL
          AND p.auth_user_id = auth.uid()
      )
      -- Case 3: Post is owned by viewer
      OR EXISTS (
        SELECT 1 FROM public.creator_posts cp
        JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
        JOIN public.profiles p ON p.id = cpr.user_id
        WHERE cp.id = post_id
          AND p.auth_user_id = auth.uid()
          AND cp.deleted_at IS NULL
      )
    )
  );

-- 5. New SELECT policy for creator_posts (followers-only posts)
CREATE POLICY "creator_posts: followers can read approved followers-only"
  ON public.creator_posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'followers'
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profile_follows pf ON pf.following_profile_id = cp.user_id
      JOIN public.profiles p ON p.id = pf.follower_profile_id
      WHERE cp.id = creator_posts.creator_profile_id
        AND p.auth_user_id = auth.uid()
    )
  );
