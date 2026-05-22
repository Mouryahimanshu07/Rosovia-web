-- =============================================================================
-- Rosovia Migration 031: Razorpay Payment Flow Webhook Concurrency Fixes
-- Depends on:
--   009_payments.sql
--   028_critical_rpc_fixes.sql
-- Purpose:
--   Harden the Razorpay webhook captured and failed handlers by replacing
--   the TOCTOU (Time-of-Check to Time-of-Use) concurrency vulnerability
--   with the secure "Read-After-Lock" pattern.
-- =============================================================================

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
  -- 1. Fetch and LOCK the payment row by provider_order_id immediately
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_order_id = p_provider_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for provider_order_id: %', p_provider_order_id
      USING errcode = 'P0002';
  END IF;

  -- 2. Idempotency (Read-After-Lock): Check if this event was already applied to the locked row
  IF p_event_id IS NOT NULL AND v_payment.webhook_event_id = p_event_id THEN
    RETURN v_payment;
  END IF;

  -- 3. Guard: If payment is already marked paid, return to prevent duplicate transitions
  IF v_payment.status = 'paid' THEN
    RETURN v_payment;
  END IF;

  -- 4. Update payment status
  UPDATE public.payments
  SET
    status               = 'paid',
    provider_payment_id  = p_provider_payment_id,
    webhook_received     = true,
    webhook_event_id     = p_event_id,
    raw_payload          = p_payload
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- 5. Lock and update the associated order
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

-- Revoke default public execution rights and restrict to service_role
REVOKE ALL ON FUNCTION public.mark_razorpay_payment_captured(text, text, text, numeric, text, jsonb) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_razorpay_payment_captured(text, text, text, numeric, text, jsonb) TO service_role;


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
  -- 1. Fetch and LOCK the payment row by provider_order_id immediately
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_order_id = p_provider_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for provider_order_id: %', p_provider_order_id
      USING errcode = 'P0002';
  END IF;

  -- 2. Idempotency (Read-After-Lock): Check if this event was already processed
  IF p_event_id IS NOT NULL AND v_payment.webhook_event_id = p_event_id THEN
    RETURN v_payment;
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

  RETURN v_payment;
END;
$$;

-- Revoke default public execution rights and restrict to service_role
REVOKE ALL ON FUNCTION public.mark_razorpay_payment_failed(text, text, text, numeric, text, jsonb) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_razorpay_payment_failed(text, text, text, numeric, text, jsonb) TO service_role;
