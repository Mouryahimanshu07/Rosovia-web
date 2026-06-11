-- Migration 063: Search work feed post IDs
-- Purpose: Standardize work feed searching and category filtering with a database RPC.

CREATE OR REPLACE FUNCTION public.search_work_feed_ids(
  search_query text,
  category_slug text,
  sort_by text,
  post_type_filter text,
  media_type_filter text,
  verified_only boolean,
  limit_count int,
  offset_count int
)
RETURNS TABLE (id uuid) AS $$
DECLARE
  cat_id uuid;
  term text;
BEGIN
  -- Resolve category ID if category_slug is provided
  IF category_slug IS NOT NULL AND category_slug <> '' THEN
    SELECT c.id INTO cat_id FROM public.categories c WHERE c.slug = category_slug;
    IF cat_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  term := CASE WHEN search_query IS NOT NULL AND search_query <> '' THEN '%' || lower(search_query) || '%' ELSE NULL END;

  RETURN QUERY
  SELECT cp.id
  FROM public.creator_posts cp
  JOIN public.creator_profiles cpr ON cpr.id = cp.creator_profile_id
  JOIN public.profiles p ON p.id = cpr.user_id
  LEFT JOIN public.listings l ON l.id = cp.listing_id
  LEFT JOIN public.categories c ON c.id = cpr.primary_category_id OR c.id = l.category_id
  WHERE cp.visibility = 'public'
    AND cp.moderation_status = 'approved'
    AND cp.deleted_at IS NULL
    AND cpr.deleted_at IS NULL
    AND p.status = 'active'
    AND p.deleted_at IS NULL
    AND (
      cat_id IS NULL OR cpr.primary_category_id = cat_id OR l.category_id = cat_id
    )
    AND (
      term IS NULL OR
      lower(cp.caption) LIKE term OR
      lower(cpr.display_name) LIKE term OR
      lower(p.username) LIKE term OR
      lower(l.title) LIKE term OR
      lower(c.name) LIKE term
    )
    AND (
      post_type_filter IS NULL OR post_type_filter = '' OR cp.post_type = post_type_filter
    )
    AND (
      media_type_filter IS NULL OR media_type_filter = '' OR
      (media_type_filter = 'video' AND cp.post_type = 'short_video') OR
      (media_type_filter = 'image' AND cp.post_type IN ('image', 'carousel', 'portfolio', 'listing_showcase'))
    )
    AND (
      verified_only IS NOT TRUE OR cpr.is_verified = true
    )
  ORDER BY
    CASE WHEN sort_by = 'popular' THEN cp.like_count ELSE 0 END DESC,
    CASE WHEN sort_by = 'popular' THEN cp.save_count ELSE 0 END DESC,
    CASE WHEN sort_by = 'popular' THEN cp.comment_count ELSE 0 END DESC,
    CASE WHEN sort_by = 'popular' THEN cp.view_count ELSE 0 END DESC,
    cp.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
