-- Migration: 059_post_engagement.sql
-- Description: Create post_likes, post_saves, post_comments tables, add comment_count to creator_posts, and setup triggers and indexes.

-- Add comment_count to creator_posts if not exists
ALTER TABLE public.creator_posts ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0);

-- Table: public.post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_unique UNIQUE(post_id, profile_id)
);

-- Table: public.post_saves
CREATE TABLE IF NOT EXISTS public.post_saves (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_saves_unique UNIQUE(post_id, profile_id)
);

-- Table: public.post_comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES public.creator_posts(id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  CONSTRAINT post_comments_body_length CHECK (char_length(body) <= 1000)
);

-- Trigger set_updated_at for post_comments
DROP TRIGGER IF EXISTS set_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER set_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS creator_posts_deleted_at_idx ON public.creator_posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS post_likes_profile_id_idx ON public.post_likes(profile_id);
CREATE INDEX IF NOT EXISTS post_saves_post_id_idx ON public.post_saves(post_id);
CREATE INDEX IF NOT EXISTS post_saves_profile_id_idx ON public.post_saves(profile_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_comments_profile_id_idx ON public.post_comments(profile_id);

-- Enable RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: post_likes
DROP POLICY IF EXISTS "post_likes: public can select" ON public.post_likes;
CREATE POLICY "post_likes: public can select"
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

DROP POLICY IF EXISTS "post_likes: authenticated users can manage own" ON public.post_likes;
CREATE POLICY "post_likes: authenticated users can manage own"
  ON public.post_likes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- RLS Policies: post_saves
DROP POLICY IF EXISTS "post_saves: users can manage own" ON public.post_saves;
CREATE POLICY "post_saves: users can manage own"
  ON public.post_saves FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- RLS Policies: post_comments
DROP POLICY IF EXISTS "post_comments: public can select active comments" ON public.post_comments;
CREATE POLICY "post_comments: public can select active comments"
  ON public.post_comments FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.creator_posts cp
      WHERE cp.id = post_comments.post_id
        AND cp.visibility = 'public'
        AND cp.moderation_status = 'approved'
        AND cp.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "post_comments: authenticated users can insert" ON public.post_comments;
CREATE POLICY "post_comments: authenticated users can insert"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
    AND status = 'active'
  );

DROP POLICY IF EXISTS "post_comments: users can update own comments, or post owner" ON public.post_comments;
CREATE POLICY "post_comments: users can update own comments, or post owner"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.creator_posts cp
      JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
      JOIN public.profiles pr ON pr.id = cpr.user_id
      WHERE cp.id = post_comments.post_id
        AND pr.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.creator_posts cp
      JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
      JOIN public.profiles pr ON pr.id = cpr.user_id
      WHERE cp.id = post_comments.post_id
        AND pr.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post_comments: users can delete own comments, or post owner" ON public.post_comments;
CREATE POLICY "post_comments: users can delete own comments, or post owner"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id
        AND p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.creator_posts cp
      JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
      JOIN public.profiles pr ON pr.id = cpr.user_id
      WHERE cp.id = post_comments.post_id
        AND pr.auth_user_id = auth.uid()
    )
  );

-- Triggers for counts
CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_posts
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

CREATE OR REPLACE FUNCTION public.sync_post_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_posts
    SET save_count = save_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_posts
    SET save_count = GREATEST(0, save_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_saves_count ON public.post_saves;
CREATE TRIGGER trg_post_saves_count
  AFTER INSERT OR DELETE ON public.post_saves
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_saves_count();

CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If status changed to hidden or deleted, decrement count; if changed back to active, increment
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE public.creator_posts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = NEW.post_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE public.creator_posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();
