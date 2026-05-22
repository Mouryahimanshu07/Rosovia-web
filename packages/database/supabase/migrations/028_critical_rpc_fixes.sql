-- =============================================================================
-- Rosovia Migration 028: Critical RPC Fixes
-- Depends on:
--   001_foundation.sql        -> profiles, is_admin(), set_updated_at()
--   002_creator_profiles.sql  -> creator_profiles
--   003_listings.sql          -> listings (stock, status, price)
--   008_orders.sql            -> orders, order_status_history
--   009_payments.sql          -> payments
--   019_refunds_disputes_payouts.sql -> current_profile_id()
-- Purpose:
--   Provide RPCs that are called by the TypeScript service layer but were
--   missing from the schema:
--     1. create_listing_order_atomic   – atomic stock reservation + order
--     2. mark_razorpay_payment_captured – webhook: payment.captured event
--     3. mark_razorpay_payment_failed   – webhook: payment.failed event
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. public.create_listing_order_atomic
--
--    Called by: packages/api/src/orders/order.service.ts
--               createOrderFromApprovedListing()
--
--    Creates an order from an approved listing atomically:
--      - Verifies the caller is an active profile (buyer).
--      - Verifies the listing is approved, not deleted, and not zero-price.
--      - Decrements listing stock by 1 (if stock tracking is enabled).
--      - Inserts the order row with status = 'payment_pending'.
--      - Returns the created order row.
--
--    NOTE: The function uses SECURITY DEFINER so that stock decrement and order
--    insert bypass the normal buyer RLS policies (which don't allow UPDATE on
--    listings).  The caller's identity is verified explicitly via
--    current_profile_id().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_listing_order_atomic(
  p_listing_id uuid
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id        uuid;
  v_listing         public.listings%ROWTYPE;
  v_creator_profile public.creator_profiles%ROWTYPE;
  v_platform_fee    numeric;
  v_seller_amount   numeric;
  v_order           public.orders%ROWTYPE;
BEGIN
  -- 1. Resolve the current buyer profile
  v_buyer_id := public.current_profile_id();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or your account is not active'
      USING errcode = 'P0001';
  END IF;

  -- 2. Lock and fetch the listing
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found'
      USING errcode = 'P0002';
  END IF;

  -- 3. Listing must be approved
  IF v_listing.status <> 'approved' THEN
    RAISE EXCEPTION 'Listing is not available for purchase (status: %)', v_listing.status
      USING errcode = 'P0009';
  END IF;

  -- 4. Price must be set and positive
  IF v_listing.price IS NULL OR v_listing.price <= 0 THEN
    RAISE EXCEPTION 'Listing does not have a valid price'
      USING errcode = 'P0006';
  END IF;

  -- 5. Stock check (only when stock tracking is enabled)
  IF v_listing.stock IS NOT NULL THEN
    IF v_listing.stock <= 0 THEN
      RAISE EXCEPTION 'Listing is out of stock'
        USING errcode = 'P0008';
    END IF;

    -- Decrement stock atomically
    UPDATE public.listings
    SET stock = stock - 1
    WHERE id = p_listing_id;
  END IF;

  -- 6. Fetch creator profile (to get creator_profiles.id for foreign key)
  SELECT * INTO v_creator_profile
  FROM public.creator_profiles
  WHERE id = v_listing.creator_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creator profile not found'
      USING errcode = 'P0002';
  END IF;

  -- 7. Buyer must not be the creator
  IF v_creator_profile.user_id = v_buyer_id THEN
    RAISE EXCEPTION 'Creators cannot purchase their own listings'
      USING errcode = 'P0003';
  END IF;

  -- 8. Calculate fees (5% platform fee, matching calculatePlatformFee in TS)
  v_platform_fee  := ROUND(v_listing.price * 0.05, 2);
  v_seller_amount := v_listing.price - v_platform_fee;

  -- 9. Insert the order
  INSERT INTO public.orders (
    buyer_id,
    creator_id,
    listing_id,
    custom_order_id,
    amount,
    platform_fee,
    seller_amount,
    currency,
    order_status,
    payment_status
  )
  VALUES (
    v_buyer_id,
    v_listing.creator_id,
    p_listing_id,
    NULL,
    v_listing.price,
    v_platform_fee,
    v_seller_amount,
    v_listing.currency,
    'payment_pending',
    'created'
  )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_listing_order_atomic(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_listing_order_atomic(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. public.mark_razorpay_payment_captured
--
--    Called by: packages/api/src/payments/payment.repository.ts
--               markRazorpayCapturedAtomic()
--
--    Webhook handler for Razorpay payment.captured events.
--    Atomically:
--      - Looks up payment by provider_order_id.
--      - Guards against duplicate webhook processing (webhook_event_id unique).
--      - Sets payment.status = 'paid' and stamps provider_payment_id.
--      - Sets order.payment_status = 'paid' and order.order_status = 'paid'
--        (transitions from payment_pending → paid).
--      - Returns the updated payment row.
--
--    This is called from the server-side webhook route using the service-role
--    client, so no RLS policy is required.  The function is granted to the
--    service_role only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_razorpay_payment_captured(
  p_event_id           text,
  p_provider_order_id  text,
  p_provider_payment_id text,
  p_amount             numeric,
  p_currency           text,
  p_payload            jsonb
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order   public.orders%ROWTYPE;
BEGIN
  -- 1. Idempotency: if this event was already processed, return existing payment
  IF p_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payments WHERE webhook_event_id = p_event_id
  ) THEN
    SELECT * INTO v_payment FROM public.payments WHERE webhook_event_id = p_event_id LIMIT 1;
    RETURN v_payment;
  END IF;

  -- 2. Fetch and lock the payment row by provider_order_id
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_order_id = p_provider_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for provider_order_id: %', p_provider_order_id
      USING errcode = 'P0002';
  END IF;

  -- 3. Update payment status
  UPDATE public.payments
  SET
    status               = 'paid',
    provider_payment_id  = p_provider_payment_id,
    webhook_received     = true,
    webhook_event_id     = p_event_id,
    raw_payload          = p_payload
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- 4. Lock and update the associated order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.orders
    SET
      payment_status = 'paid',
      order_status   = CASE
                         WHEN order_status = 'payment_pending' THEN 'paid'
                         ELSE order_status
                       END
    WHERE id = v_order.id;

    -- Insert status history if the order transitioned
    IF v_order.order_status = 'payment_pending' THEN
      INSERT INTO public.order_status_history (
        order_id, old_status, new_status, changed_by, note
      )
      VALUES (
        v_order.id,
        'payment_pending',
        'paid',
        NULL,
        'Payment captured via Razorpay webhook'
      );
    END IF;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_razorpay_payment_captured(text, text, text, numeric, text, jsonb) FROM public;
-- Service-role client is used from the webhook route, no GRANT needed.
-- Grant to authenticated as well for admin payment tooling if needed.
GRANT EXECUTE ON FUNCTION public.mark_razorpay_payment_captured(text, text, text, numeric, text, jsonb) TO service_role;


-- ---------------------------------------------------------------------------
-- 3. public.mark_razorpay_payment_failed
--
--    Called by: packages/api/src/payments/payment.repository.ts
--               markRazorpayFailedAtomic()
--
--    Webhook handler for Razorpay payment.failed events.
--    Atomically:
--      - Looks up payment by provider_order_id.
--      - Guards against duplicate webhook processing (webhook_event_id unique).
--      - Sets payment.status = 'failed'.
--      - Does NOT change the order status (buyer can retry payment).
--      - Returns the updated payment row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_razorpay_payment_failed(
  p_event_id           text,
  p_provider_order_id  text,
  p_provider_payment_id text,
  p_amount             numeric,
  p_currency           text,
  p_payload            jsonb
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  -- 1. Idempotency: if this event was already processed, return existing payment
  IF p_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payments WHERE webhook_event_id = p_event_id
  ) THEN
    SELECT * INTO v_payment FROM public.payments WHERE webhook_event_id = p_event_id LIMIT 1;
    RETURN v_payment;
  END IF;

  -- 2. Fetch and lock the payment row by provider_order_id
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_order_id = p_provider_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for provider_order_id: %', p_provider_order_id
      USING errcode = 'P0002';
  END IF;

  -- 3. Only mark failed if not already paid (avoid downgrading a paid payment)
  IF v_payment.status = 'paid' THEN
    RETURN v_payment;
  END IF;

  -- 4. Update payment status to failed
  UPDATE public.payments
  SET
    status               = 'failed',
    provider_payment_id  = p_provider_payment_id,
    webhook_received     = true,
    webhook_event_id     = p_event_id,
    raw_payload          = p_payload
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- NOTE: Order payment_status stays 'pending' so buyer can retry.

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_razorpay_payment_failed(text, text, text, numeric, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_razorpay_payment_failed(text, text, text, numeric, text, jsonb) TO service_role;


-- =============================================================================
-- End of migration 028_critical_rpc_fixes.sql
-- =============================================================================
