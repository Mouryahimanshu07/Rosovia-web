-- =============================================================================
-- Rosovia Migration 030: Row-Level Security (RLS) & RPC Security Audit Fixes
-- Depends on:
--   001_foundation.sql
--   007_custom_orders.sql
--   010_reviews.sql
--   011_verification_requests.sql
--   016_payment_order_transactions.sql
--   019_refunds_disputes_payouts.sql
--   023_admin_atomic_actions.sql
--   026_notifications.sql
--   027_delivery_confirmation.sql
-- Purpose:
--   Implements 10 targeted security patches stemming from the RLS & RPC Security Audit:
--     1. [VULN-01] Enable RLS and restrict access on public.webhook_events.
--     2. [VULN-02] Harden SECURITY DEFINER create_creator_payout_for_order and revoke public execution.
--     3. [VULN-03] Restrict public unconstrained inserts on public.notifications.
--     4. [VULN-04a] Guard order_deliveries column-level updates via before update trigger.
--     5. [VULN-04b] Guard custom_orders column-level updates via before update trigger.
--     6. [VULN-04c] Guard conversations column-level updates via before update trigger.
--     7. [VULN-04d] Guard notifications column-level updates via before update trigger.
--     8. [VULN-05] Guard reviews direct table-level inserts via before insert trigger.
--     9. [VULN-06] Systematically revoke default PUBLIC execution rights from admin RPC functions.
--     10. [VULN-07] Guard verification_requests document media ownership via before insert trigger.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. [VULN-01] Enable RLS & Restrict Access on public.webhook_events
-- ---------------------------------------------------------------------------

-- Enable Row Level Security on webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow only administrators or service-role (bypass) to read webhook logs
DROP POLICY IF EXISTS "webhook_events: admin can read all" ON public.webhook_events;
CREATE POLICY "webhook_events: admin can read all"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- ---------------------------------------------------------------------------
-- 2. [VULN-02] Secure create_creator_payout_for_order SECURITY DEFINER RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_creator_payout_for_order(
  p_order_id uuid
)
RETURNS public.creator_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_payout public.creator_payouts%rowtype;
BEGIN
  -- Strict Caller Authorization Check: only admins or service role allowed
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only system service or admin can initiate payouts'
      USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND deleted_at is null
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status <> 'paid' then
    RAISE EXCEPTION 'Payout can only be created for paid orders';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
    AND status = 'paid'
    AND deleted_at is null
  ORDER BY created_at desc
  LIMIT 1;

  INSERT INTO public.creator_payouts (
    creator_id,
    order_id,
    payment_id,
    amount,
    currency,
    status,
    provider
  )
  VALUES (
    v_order.creator_id,
    v_order.id,
    CASE WHEN v_payment.id is null THEN null ELSE v_payment.id END,
    v_order.seller_amount,
    v_order.currency,
    'pending',
    'manual'
  )
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_payout
  FROM public.creator_payouts
  WHERE order_id = p_order_id
    AND deleted_at is null
  ORDER BY created_at desc
  LIMIT 1;

  IF v_payout.id is null then
    RAISE EXCEPTION 'Failed to create or fetch payout';
  END IF;

  RETURN v_payout;
END;
$$;

-- Revoke default public/authenticated/anon execution rights and restrict to service_role
REVOKE ALL ON FUNCTION public.create_creator_payout_for_order(uuid) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_creator_payout_for_order(uuid) TO service_role;


-- ---------------------------------------------------------------------------
-- 3. [VULN-03] Restrict Broad public authenticated writes on public.notifications
-- ---------------------------------------------------------------------------

-- Revoke broad public authenticated inserts
DROP POLICY IF EXISTS "notifications: service can insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications: admin can insert" ON public.notifications;

-- Restrict direct insertion to admin role. Standard system-generated notification
-- inserts are executed via the service-role client, bypassing RLS automatically.
CREATE POLICY "notifications: admin can insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. [VULN-04] PostgREST Column-Level Modification & State Bypass triggers
-- ---------------------------------------------------------------------------

-- 4a. Column Enforcement Trigger on public.order_deliveries
CREATE OR REPLACE FUNCTION public.guard_order_deliveries_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and postgres superuser bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin can modify all fields
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Immutable System Identity & Order References
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.order_id IS DISTINCT FROM OLD.order_id OR
     NEW.creator_id IS DISTINCT FROM OLD.creator_id OR
     NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'You cannot change system identity or references on a delivery record'
      USING errcode = 'P0501';
  END IF;

  -- Creator Role Validation: Only allow shipping progress updates
  IF EXISTS (
    SELECT 1 FROM public.creator_profiles cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.id = OLD.creator_id AND p.auth_user_id = auth.uid()
  ) THEN
    -- Creator cannot change buyer confirmation fields
    IF NEW.buyer_confirmed_at IS DISTINCT FROM OLD.buyer_confirmed_at THEN
      RAISE EXCEPTION 'Creators are not allowed to confirm their own deliveries'
        USING errcode = 'P0502';
    END IF;
    -- Creator status transition restrictions
    IF NEW.status = 'buyer_confirmed' AND OLD.status IS DISTINCT FROM 'buyer_confirmed' THEN
      RAISE EXCEPTION 'Creators cannot set delivery status to buyer_confirmed directly'
        USING errcode = 'P0503';
    END IF;
    RETURN NEW;
  END IF;

  -- Buyer Role Validation: Only allow confirmation updates
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = OLD.buyer_id AND p.auth_user_id = auth.uid()
  ) THEN
    -- Buyer cannot change creator tracking details
    IF NEW.tracking_reference IS DISTINCT FROM OLD.tracking_reference OR
       NEW.delivery_note IS DISTINCT FROM OLD.delivery_note OR
       NEW.shipped_at IS DISTINCT FROM OLD.shipped_at OR
       NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR
       NEW.delivery_type IS DISTINCT FROM OLD.delivery_type THEN
      RAISE EXCEPTION 'Buyers are not allowed to modify creator fulfillment details'
        USING errcode = 'P0504';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized update request on delivery'
    USING errcode = 'P0505';
END;
$$;

DROP TRIGGER IF EXISTS guard_order_deliveries_update ON public.order_deliveries;
CREATE TRIGGER guard_order_deliveries_update
  BEFORE UPDATE ON public.order_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_deliveries_update();


-- 4b. Column Enforcement Trigger on public.custom_orders
CREATE OR REPLACE FUNCTION public.guard_custom_orders_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  -- Service role and postgres superuser bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin can modify all fields
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_caller_id := public.current_profile_id();

  -- Immutable properties for all non-admins
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR
     NEW.creator_id IS DISTINCT FROM OLD.creator_id OR
     NEW.listing_id IS DISTINCT FROM OLD.listing_id OR
     NEW.category_id IS DISTINCT FROM OLD.category_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'You cannot modify core custom order assignments'
      USING errcode = 'P0601';
  END IF;

  -- Buyer specific updates
  IF OLD.buyer_id = v_caller_id THEN
    -- Buyer CANNOT change the quote values once set by creator
    IF NEW.creator_quote_amount IS DISTINCT FROM OLD.creator_quote_amount OR
       NEW.creator_quote_note IS DISTINCT FROM OLD.creator_quote_note THEN
      RAISE EXCEPTION 'Buyers are not allowed to modify creator quote values'
        USING errcode = 'P0602';
    END IF;
    -- Buyer CANNOT alter initial requirements during transition
    IF NEW.title IS DISTINCT FROM OLD.title OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.budget_min IS DISTINCT FROM OLD.budget_min OR
       NEW.budget_max IS DISTINCT FROM OLD.budget_max OR
       NEW.deadline IS DISTINCT FROM OLD.deadline OR
       NEW.delivery_city IS DISTINCT FROM OLD.delivery_city OR
       NEW.delivery_state IS DISTINCT FROM OLD.delivery_state THEN
      RAISE EXCEPTION 'Buyers cannot modify order specifications once review has started'
        USING errcode = 'P0603';
    END IF;
    RETURN NEW;
  END IF;

  -- Creator specific updates
  IF EXISTS (
    SELECT 1 FROM public.creator_profiles cp
    WHERE cp.id = OLD.creator_id AND cp.user_id = v_caller_id
  ) THEN
    -- Creator CANNOT modify buyer's original requirements
    IF NEW.title IS DISTINCT FROM OLD.title OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.budget_min IS DISTINCT FROM OLD.budget_min OR
       NEW.budget_max IS DISTINCT FROM OLD.budget_max OR
       NEW.deadline IS DISTINCT FROM OLD.deadline OR
       NEW.delivery_city IS DISTINCT FROM OLD.delivery_city OR
       NEW.delivery_state IS DISTINCT FROM OLD.delivery_state OR
       NEW.reference_media_id IS DISTINCT FROM OLD.reference_media_id THEN
      RAISE EXCEPTION 'Creators are not allowed to modify buyer request parameters'
        USING errcode = 'P0604';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Access Denied'
    USING errcode = 'P0605';
END;
$$;

DROP TRIGGER IF EXISTS guard_custom_orders_update ON public.custom_orders;
CREATE TRIGGER guard_custom_orders_update
  BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_custom_orders_update();


-- 4c. Column Enforcement Trigger on public.conversations
CREATE OR REPLACE FUNCTION public.guard_conversations_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and postgres superuser bypass
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins: only last_message_at can be updated.
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR
     NEW.creator_id IS DISTINCT FROM OLD.creator_id OR
     NEW.order_id IS DISTINCT FROM OLD.order_id OR
     NEW.inquiry_id IS DISTINCT FROM OLD.inquiry_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'You cannot modify conversation assignments or metadata'
      USING errcode = 'P0701';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_conversations_update ON public.conversations;
CREATE TRIGGER guard_conversations_update
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_conversations_update();


-- 4d. Column Enforcement Trigger on public.notifications
CREATE OR REPLACE FUNCTION public.guard_notifications_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and postgres superuser bypass
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Recipients may ONLY update read_at and deleted_at (soft delete)
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.recipient_profile_id IS DISTINCT FROM OLD.recipient_profile_id OR
     NEW.type IS DISTINCT FROM OLD.type OR
     NEW.title IS DISTINCT FROM OLD.title OR
     NEW.body IS DISTINCT FROM OLD.body OR
     NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
     NEW.entity_id IS DISTINCT FROM OLD.entity_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notification parameters are read-only'
      USING errcode = 'P0801';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_notifications_update ON public.notifications;
CREATE TRIGGER guard_notifications_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notifications_update();


-- ---------------------------------------------------------------------------
-- 5. [VULN-05] reviews Direct Insertion & Rating Recalculation Bypass Trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_reviews_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%rowtype;
BEGIN
  -- 1. Allow service-role inserts
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch target order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review references a non-existent or deleted order'
      USING errcode = 'P0901';
  END IF;

  -- 3. Enforce alignment between review data and order metadata
  IF v_order.buyer_id IS DISTINCT FROM NEW.buyer_id THEN
    RAISE EXCEPTION 'Buyer ID mismatch with the order record'
      USING errcode = 'P0902';
  END IF;

  IF v_order.creator_id IS DISTINCT FROM NEW.creator_id THEN
    RAISE EXCEPTION 'Creator ID mismatch with the order record'
      USING errcode = 'P0903';
  END IF;

  IF v_order.listing_id IS DISTINCT FROM NEW.listing_id THEN
    RAISE EXCEPTION 'Listing ID mismatch with the order record'
      USING errcode = 'P0904';
  END IF;

  -- 4. Verify order state is qualified for review
  IF v_order.order_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Reviews can only be submitted for completed orders (current status: %)', v_order.order_status
      USING errcode = 'P0905';
  END IF;

  IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Reviews can only be submitted for paid orders'
      USING errcode = 'P0906';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_reviews_insert ON public.reviews;
CREATE TRIGGER guard_reviews_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_reviews_insert();


-- ---------------------------------------------------------------------------
-- 6. [VULN-06] Insecure Default Administrative RPC Privileges Revocation
-- ---------------------------------------------------------------------------

-- 6a. public.admin_set_user_status_atomic
REVOKE ALL ON FUNCTION public.admin_set_user_status_atomic(uuid, text, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status_atomic(uuid, text, text) TO service_role;

-- 6b. public.admin_moderate_listing_atomic
REVOKE ALL ON FUNCTION public.admin_moderate_listing_atomic(uuid, text, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing_atomic(uuid, text, text) TO service_role;

-- 6c. public.admin_moderate_review_atomic
REVOKE ALL ON FUNCTION public.admin_moderate_review_atomic(uuid, boolean, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_review_atomic(uuid, boolean, text) TO service_role;

-- 6d. public.admin_resolve_report_atomic
REVOKE ALL ON FUNCTION public.admin_resolve_report_atomic(uuid, text, text, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report_atomic(uuid, text, text, text) TO service_role;

-- 6e. public.admin_update_verification_atomic
REVOKE ALL ON FUNCTION public.admin_update_verification_atomic(uuid, text, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_verification_atomic(uuid, text, text) TO service_role;


-- ---------------------------------------------------------------------------
-- 7. [VULN-07] Private Identity Document Hijacking & Ownership Trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_verification_requests_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate document asset ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.media_assets
    WHERE id = NEW.document_media_id
      AND owner_id = NEW.user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Document media asset not found or does not belong to your profile'
      USING errcode = 'P1001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_verification_requests_insert ON public.verification_requests;
CREATE TRIGGER guard_verification_requests_insert
  BEFORE INSERT ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_verification_requests_insert();
