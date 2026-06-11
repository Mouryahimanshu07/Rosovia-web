-- =============================================================================
-- Rosovia Custom Order RLS Fix
-- Migration: 057_custom_order_rls_fix.sql
-- Purpose: Ensures RLS policies for custom orders are robust and correct.
-- =============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- 1. Buyer can read own custom orders
DROP POLICY IF EXISTS "custom_orders: buyer can read own" ON public.custom_orders;
CREATE POLICY "custom_orders: buyer can read own"
  ON public.custom_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = custom_orders.buyer_id
        AND p.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- 2. Buyer can create own custom order request
DROP POLICY IF EXISTS "custom_orders: buyer can create own" ON public.custom_orders;
CREATE POLICY "custom_orders: buyer can create own"
  ON public.custom_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = custom_orders.buyer_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
    AND status = 'requested'
    AND creator_quote_amount IS NULL
    AND creator_quote_note IS NULL
  );

-- 3. Buyer can update own custom order (limited states)
DROP POLICY IF EXISTS "custom_orders: buyer can update own" ON public.custom_orders;
CREATE POLICY "custom_orders: buyer can update own"
  ON public.custom_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = custom_orders.buyer_id
        AND p.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND custom_orders.status IN ('requested', 'creator_reviewing', 'quoted')
    AND custom_orders.deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = custom_orders.buyer_id
        AND p.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND status IN ('accepted', 'cancelled')
  );

-- 4. Creator can read assigned custom orders
DROP POLICY IF EXISTS "custom_orders: creator can read assigned" ON public.custom_orders;
CREATE POLICY "custom_orders: creator can read assigned"
  ON public.custom_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = custom_orders.creator_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND p.deleted_at IS NULL
        AND cp.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- 5. Creator can update assigned custom orders (status update & quote)
DROP POLICY IF EXISTS "custom_orders: creator can update assigned" ON public.custom_orders;
CREATE POLICY "custom_orders: creator can update assigned"
  ON public.custom_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = custom_orders.creator_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND p.deleted_at IS NULL
        AND cp.deleted_at IS NULL
    )
    AND custom_orders.status IN ('requested', 'creator_reviewing', 'quoted')
    AND custom_orders.deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      JOIN public.profiles p ON p.id = cp.user_id
      WHERE cp.id = custom_orders.creator_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
        AND p.deleted_at IS NULL
        AND cp.deleted_at IS NULL
    )
    AND status IN ('creator_reviewing', 'quoted', 'rejected', 'cancelled')
  );
