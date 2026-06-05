-- Migration 047: Admin post moderation
-- Purpose: Support admin post moderation actions in admin_actions and provide the admin_moderate_post_atomic RPC.

-- 1. Update check constraint on admin_actions table to include post_approved, post_rejected, post_hidden
ALTER TABLE public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_type_check;

ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_action_type_check CHECK (
  action_type IN (
    -- Report moderation
    'report_reviewed',
    'report_resolved',
    'report_rejected',

    -- Review moderation
    'review_hidden',
    'review_unhidden',

    -- Listing moderation
    'listing_suspended',
    'listing_unsuspended',
    'listing_approved',
    'listing_rejected',
    'listing_archived',

    -- Post moderation
    'post_approved',
    'post_rejected',
    'post_hidden',

    -- User/creator moderation
    'user_suspended',
    'user_unsuspended',
    'creator_suspended',
    'creator_unsuspended',

    -- Verification
    'verification_reviewed',

    -- Category management
    'category_created',
    'category_updated',

    -- Refund lifecycle
    'refund_requested',
    'refund_approved',
    'refund_rejected',
    'refund_processed',
    'refund_failed',
    'refund_cancelled',

    -- Dispute lifecycle
    'dispute_opened',
    'dispute_under_review',
    'dispute_resolved',
    'dispute_rejected',

    -- Creator payout lifecycle
    'payout_created',
    'payout_processing',
    'payout_paid',
    'payout_failed',
    'payout_on_hold',

    -- Generic
    'manual_note'
  )
);

-- 2. Update check constraint on admin_actions target_type to include 'post'
ALTER TABLE public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_target_type_check;

ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_target_type_check CHECK (
  target_type IN (
    'report',
    'category',
    'creator',
    'listing',
    'review',
    'user',
    'verification_request',
    'order',
    'payment',
    'refund_request',
    'dispute',
    'creator_payout',
    'post'
  )
);

-- 3. Create public.admin_moderate_post_atomic function
CREATE OR REPLACE FUNCTION public.admin_moderate_post_atomic(
  p_post_id uuid,
  p_status text,
  p_note text default null,
  p_admin_id uuid default null
) RETURNS public.creator_posts AS $$
DECLARE
  v_admin_id uuid;
  v_post public.creator_posts;
  v_action_type text;
BEGIN
  -- Determine admin profile ID
  IF auth.role() = 'service_role' THEN
    IF p_admin_id IS NULL THEN
      RAISE EXCEPTION 'Admin profile ID is required when executing via service_role';
    END IF;
    
    -- Verify the provided admin profile ID is active and is indeed an admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_admin_id AND role = 'admin' AND status = 'active' AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid or inactive admin profile ID';
    END IF;
    
    v_admin_id := p_admin_id;
  ELSE
    v_admin_id := public.current_profile_id();
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Admin access required';
    END IF;
  END IF;

  -- Validate post status
  IF p_status NOT IN ('pending', 'approved', 'rejected', 'hidden') THEN
    RAISE EXCEPTION 'Invalid post status: %', p_status;
  END IF;

  -- Fetch & Lock post
  SELECT * INTO v_post FROM public.creator_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Update post status
  UPDATE public.creator_posts
  SET moderation_status = p_status
  WHERE id = p_post_id
  RETURNING * INTO v_post;

  -- Map to action types
  IF p_status = 'approved' THEN v_action_type := 'post_approved';
  ELSIF p_status = 'rejected' THEN v_action_type := 'post_rejected';
  ELSIF p_status = 'hidden' THEN v_action_type := 'post_hidden';
  ELSE v_action_type := 'post_approved'; END IF;

  -- Log the admin action
  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    v_action_type,
    'post',
    p_post_id,
    p_note,
    jsonb_build_object('new_status', p_status)
  );

  RETURN v_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Restrict execution on this RPC to service_role (preserving high security audit requirement)
REVOKE ALL ON FUNCTION public.admin_moderate_post_atomic(uuid, text, text, uuid) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post_atomic(uuid, text, text, uuid) TO service_role;
