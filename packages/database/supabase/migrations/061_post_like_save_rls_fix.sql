-- Drop old policies on post_likes
DROP POLICY IF EXISTS "post_likes: public can select" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: authenticated users can manage own" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: public can select active" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: authenticated users can insert own if post is active" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes: authenticated users can delete own" ON public.post_likes;

-- Drop old policies on post_saves
DROP POLICY IF EXISTS "post_saves: users can manage own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves: authenticated users can select own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves: authenticated users can insert own if post is active" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves: authenticated users can delete own" ON public.post_saves;

-- Refined policies for post_likes
CREATE POLICY "post_likes: public can select active"
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

CREATE POLICY "post_likes: authenticated users can insert own if post is active"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.creator_posts cp
      WHERE cp.id = post_id
        AND cp.visibility = 'public'
        AND cp.moderation_status = 'approved'
        AND cp.deleted_at IS NULL
    )
  );

CREATE POLICY "post_likes: authenticated users can delete own"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- Refined policies for post_saves
CREATE POLICY "post_saves: authenticated users can select own"
  ON public.post_saves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "post_saves: authenticated users can insert own if post is active"
  ON public.post_saves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.creator_posts cp
      WHERE cp.id = post_id
        AND cp.visibility = 'public'
        AND cp.moderation_status = 'approved'
        AND cp.deleted_at IS NULL
    )
  );

CREATE POLICY "post_saves: authenticated users can delete own"
  ON public.post_saves FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  );
