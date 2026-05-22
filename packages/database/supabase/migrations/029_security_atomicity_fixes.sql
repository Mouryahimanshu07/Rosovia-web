-- =============================================================================
-- Rosovia Migration 029: Security & Atomicity Fixes
-- Depends on:
--   001_foundation.sql        -> profiles, is_admin(), set_updated_at(), current_profile_id()
--   002_creator_profiles.sql  -> creator_profiles
--   007_custom_orders.sql     -> custom_orders
--   008_orders.sql            -> orders, order_status_history
--   009_payments.sql          -> payments
--   019_refunds_disputes_payouts.sql -> current_profile_id()
--   025_messaging.sql         -> conversations, messages
-- Purpose:
--   Three targeted fixes from the codebase security audit:
--     1. create_custom_order_atomic  – atomic duplicate guard + order creation
--                                      for custom order path (C4: TOCTOU fix)
--     2. guard_message_read_at_only  – trigger to prevent non-admins from
--                                      updating message fields other than read_at
--                                      (H2: always-true with check fix)
--     3. conversations unique index  – prevents duplicate conversations between
--                                      the same buyer/creator pair (M4)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. public.create_custom_order_atomic
--
--    Called by: packages/api/src/orders/order.service.ts
--               createOrderFromAcceptedCustomOrder()
--
--    Creates an order from an accepted custom order atomically:
--      - Verifies the caller is an active profile (buyer).
--      - Acquires a FOR UPDATE lock on the custom_order row to prevent TOCTOU.
--      - Validates: custom order belongs to caller, status = 'accepted',
--        quote amount is positive, no duplicate order already exists.
--      - Calculates platform fee (10%) and seller amount.
--      - Inserts the order row with status = 'payment_pending'.
--      - Returns the created order row.
--
--    The 10% platform fee mirrors calculatePlatformFee() in @rosovia/core.
--    The FOR UPDATE lock prevents two concurrent requests from passing the
--    duplicate-order check simultaneously before either insert completes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_custom_order_atomic(
  p_custom_order_id uuid
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id      uuid;
  v_custom_order  public.custom_orders%ROWTYPE;
  v_platform_fee  numeric;
  v_seller_amount numeric;
  v_order         public.orders%ROWTYPE;
BEGIN
  -- 1. Resolve the current buyer profile
  v_buyer_id := public.current_profile_id();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or your account is not active'
      USING errcode = 'P0001';
  END IF;

  -- 2. Lock and fetch the custom order (FOR UPDATE prevents race condition)
  SELECT * INTO v_custom_order
  FROM public.custom_orders
  WHERE id = p_custom_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom order not found'
      USING errcode = 'P0002';
  END IF;

  -- 3. Caller must be the buyer of this custom order
  IF v_custom_order.buyer_id <> v_buyer_id THEN
    RAISE EXCEPTION 'This custom order does not belong to you'
      USING errcode = 'P0003';
  END IF;

  -- 4. Custom order must be in 'accepted' status
  IF v_custom_order.status <> 'accepted' THEN
    RAISE EXCEPTION 'An order can only be created for an accepted custom order quote (current status: %)',
      v_custom_order.status
      USING errcode = 'P0004';
  END IF;

  -- 5. Quote amount must be set and positive
  IF v_custom_order.creator_quote_amount IS NULL OR v_custom_order.creator_quote_amount <= 0 THEN
    RAISE EXCEPTION 'Custom order does not have a valid quote amount'
      USING errcode = 'P0006';
  END IF;

  -- 6. Duplicate order check — within the same lock scope
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE custom_order_id = p_custom_order_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'An order already exists for this custom order'
      USING errcode = 'P0007';
  END IF;

  -- 7. Calculate fees (10% platform fee, matching calculatePlatformFee in TS)
  v_platform_fee  := ROUND(v_custom_order.creator_quote_amount * 0.10, 2);
  v_seller_amount := v_custom_order.creator_quote_amount - v_platform_fee;

  -- 8. Insert the order
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
    v_custom_order.creator_id,
    NULL,
    p_custom_order_id,
    v_custom_order.creator_quote_amount,
    v_platform_fee,
    v_seller_amount,
    'INR',
    'payment_pending',
    'created'
  )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_custom_order_atomic(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_custom_order_atomic(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. guard_message_read_at_only
--
--    Fixes the always-true with check on messages UPDATE RLS (H2).
--
--    The original policy:
--      with check ( (read_at is null or read_at is not null) )
--    is a tautology — always evaluates to TRUE — allowing any conversation
--    participant to update any field on any message they can read.
--
--    This trigger fires BEFORE any UPDATE on messages for non-admin users and
--    raises an exception if any field other than read_at is being changed.
--    Admins (public.is_admin()) are exempt and can update any field.
--
--    The trigger checks column-level changes using OLD vs NEW comparison.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_message_read_at_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may update any field
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins: only read_at may change
  IF NEW.conversation_id  <> OLD.conversation_id  THEN
    RAISE EXCEPTION 'Cannot change conversation_id on a message'
      USING errcode = 'P0401';
  END IF;
  IF NEW.sender_profile_id <> OLD.sender_profile_id THEN
    RAISE EXCEPTION 'Cannot change sender_profile_id on a message'
      USING errcode = 'P0401';
  END IF;
  IF NEW.body             <> OLD.body              THEN
    RAISE EXCEPTION 'Cannot change message body after sending'
      USING errcode = 'P0401';
  END IF;
  -- deleted_at: non-admins cannot soft-delete messages
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot change deleted_at on a message'
      USING errcode = 'P0401';
  END IF;

  -- read_at changes are always allowed — that is the intended operation
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_read_at_only ON public.messages;
CREATE TRIGGER guard_message_read_at_only
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_message_read_at_only();


-- ---------------------------------------------------------------------------
-- 3. Unique index: one active conversation per (buyer_id, creator_id) pair
--
--    Prevents duplicate conversation threads being created between the same
--    buyer and creator. Without this constraint a buyer can open multiple
--    inbox threads with the same creator, fragmenting message history.
--
--    Partial index (WHERE deleted_at IS NULL) so soft-deleted conversations
--    do not block a fresh conversation being started.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_creator_unique_idx
  ON public.conversations (buyer_id, creator_id)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- End of migration 029_security_atomicity_fixes.sql
-- =============================================================================
