-- Migration 023: Admin atomic actions

-- 1. admin_set_user_status_atomic
CREATE OR REPLACE FUNCTION public.admin_set_user_status_atomic(
  p_user_id uuid,
  p_status text,
  p_note text default null
) RETURNS public.profiles AS $$
DECLARE
  v_admin_id uuid;
  v_profile public.profiles;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF v_admin_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot suspend your own admin account.';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE public.profiles
  SET status = p_status
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    CASE WHEN p_status = 'suspended' THEN 'user_suspended' ELSE 'user_unsuspended' END,
    'user',
    p_user_id,
    p_note,
    jsonb_build_object('previous_status', v_profile.status)
  );

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. admin_moderate_listing_atomic
CREATE OR REPLACE FUNCTION public.admin_moderate_listing_atomic(
  p_listing_id uuid,
  p_status text,
  p_note text default null
) RETURNS public.listings AS $$
DECLARE
  v_admin_id uuid;
  v_listing public.listings;
  v_action_type text;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  UPDATE public.listings
  SET status = p_status::public.listing_status
  WHERE id = p_listing_id
  RETURNING * INTO v_listing;

  IF p_status = 'approved' THEN v_action_type := 'listing_approved';
  ELSIF p_status = 'rejected' THEN v_action_type := 'listing_rejected';
  ELSIF p_status = 'suspended' OR p_status = 'archived' THEN v_action_type := 'listing_suspended';
  ELSE v_action_type := 'listing_updated'; END IF;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    v_action_type,
    'listing',
    p_listing_id,
    p_note,
    jsonb_build_object('status', p_status)
  );

  RETURN v_listing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. admin_moderate_review_atomic
CREATE OR REPLACE FUNCTION public.admin_moderate_review_atomic(
  p_review_id uuid,
  p_is_hidden boolean,
  p_note text default null
) RETURNS public.reviews AS $$
DECLARE
  v_admin_id uuid;
  v_review public.reviews;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  UPDATE public.reviews
  SET is_hidden = p_is_hidden
  WHERE id = p_review_id
  RETURNING * INTO v_review;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    CASE WHEN p_is_hidden THEN 'review_hidden' ELSE 'review_unhidden' END,
    'review',
    p_review_id,
    p_note,
    jsonb_build_object('is_hidden', p_is_hidden)
  );

  RETURN v_review;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. admin_resolve_report_atomic
CREATE OR REPLACE FUNCTION public.admin_resolve_report_atomic(
  p_report_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_target_action text default null
) RETURNS public.reports AS $$
DECLARE
  v_admin_id uuid;
  v_report public.reports;
  v_action_type text;
  v_target_type text;
  v_log_target_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF p_target_action = 'hide_review' THEN
    IF v_report.target_type != 'review' THEN RAISE EXCEPTION 'Invalid target type for action'; END IF;
    UPDATE public.reviews SET is_hidden = true WHERE id = v_report.target_id::uuid;
    v_action_type := 'review_hidden';
    v_target_type := 'review';
    v_log_target_id := v_report.target_id::uuid;
  ELSIF p_target_action = 'suspend_listing' THEN
    IF v_report.target_type != 'listing' THEN RAISE EXCEPTION 'Invalid target type for action'; END IF;
    UPDATE public.listings SET status = 'suspended' WHERE id = v_report.target_id::uuid;
    v_action_type := 'listing_suspended';
    v_target_type := 'listing';
    v_log_target_id := v_report.target_id::uuid;
  ELSIF p_target_action = 'suspend_user' THEN
    IF v_report.target_type != 'user' THEN RAISE EXCEPTION 'Invalid target type for action'; END IF;
    UPDATE public.profiles SET status = 'suspended' WHERE id = v_report.target_id::uuid;
    v_action_type := 'user_suspended';
    v_target_type := 'user';
    v_log_target_id := v_report.target_id::uuid;
  ELSE
    IF p_status = 'reviewed' THEN v_action_type := 'report_reviewed';
    ELSIF p_status = 'resolved' THEN v_action_type := 'report_resolved';
    ELSIF p_status = 'rejected' THEN v_action_type := 'report_rejected';
    ELSE v_action_type := 'report_updated'; END IF;
    v_target_type := 'report';
    v_log_target_id := p_report_id;
  END IF;

  UPDATE public.reports
  SET status = p_status::public.report_status,
      admin_note = p_resolution_note,
      reviewed_by = v_admin_id,
      reviewed_at = now()
  WHERE id = p_report_id
  RETURNING * INTO v_report;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    v_action_type,
    v_target_type,
    v_log_target_id,
    p_resolution_note,
    jsonb_build_object('report_id', p_report_id)
  );

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. admin_update_verification_atomic
CREATE OR REPLACE FUNCTION public.admin_update_verification_atomic(
  p_verification_request_id uuid,
  p_status text,
  p_note text default null
) RETURNS public.verification_requests AS $$
DECLARE
  v_admin_id uuid;
  v_req public.verification_requests;
  v_action_type text;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM public.verification_requests WHERE id = p_verification_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  UPDATE public.verification_requests
  SET status = p_status::public.verification_request_status,
      admin_note = p_note,
      reviewed_by = v_admin_id,
      reviewed_at = now()
  WHERE id = p_verification_request_id
  RETURNING * INTO v_req;

  IF p_status = 'approved' THEN
    UPDATE public.creator_profiles 
    SET is_verified = true, verification_level = v_req.request_type
    WHERE id = v_req.creator_id;
    v_action_type := 'verification_approved';
  ELSIF p_status = 'rejected' THEN
    v_action_type := 'verification_rejected';
  ELSE
    v_action_type := 'verification_updated';
  END IF;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, note, metadata)
  VALUES (
    v_admin_id,
    v_action_type,
    'creator',
    v_req.creator_id,
    p_note,
    jsonb_build_object('verification_request_id', p_verification_request_id)
  );

  RETURN v_req;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
