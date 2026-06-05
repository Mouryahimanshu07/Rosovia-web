-- Migration 046: Admin listing moderation fixes
-- Purpose: Add 'listing_archived' action type and update admin_moderate_listing_atomic RPC function.

-- 1. Update check constraint on admin_actions table to include listing_archived
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

-- 2. Drop existing function first to handle changes in parameters/signature
DROP FUNCTION IF EXISTS public.admin_moderate_listing_atomic(uuid, text, text);

-- 3. Re-create function supporting p_admin_id parameter
CREATE OR REPLACE FUNCTION public.admin_moderate_listing_atomic(
  p_listing_id uuid,
  p_status text,
  p_note text default null,
  p_admin_id uuid default null
) RETURNS public.listings AS $$
DECLARE
  v_admin_id uuid;
  v_listing public.listings;
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

  -- Validate listing status
  IF p_status NOT IN ('draft', 'pending_review', 'approved', 'rejected', 'archived', 'suspended') THEN
    RAISE EXCEPTION 'Invalid listing status: %', p_status;
  END IF;

  -- Fetch & Lock listing
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Update listing status
  UPDATE public.listings
  SET status = p_status
  WHERE id = p_listing_id
  RETURNING * INTO v_listing;

  -- Map to action types
  IF p_status = 'approved' THEN v_action_type := 'listing_approved';
  ELSIF p_status = 'rejected' THEN v_action_type := 'listing_rejected';
  ELSIF p_status = 'suspended' THEN v_action_type := 'listing_suspended';
  ELSIF p_status = 'archived' THEN v_action_type := 'listing_archived';
  ELSE v_action_type := 'listing_approved'; END IF;

  -- Log the admin action
  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    v_action_type,
    'listing',
    p_listing_id,
    p_note,
    jsonb_build_object('new_status', p_status)
  );

  RETURN v_listing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Restrict execution on this RPC to service_role (preserving high security audit requirement)
REVOKE ALL ON FUNCTION public.admin_moderate_listing_atomic(uuid, text, text, uuid) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing_atomic(uuid, text, text, uuid) TO service_role;
