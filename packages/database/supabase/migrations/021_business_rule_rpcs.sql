-- =============================================================================
-- Rosovia Step 12: Business Rule RPCs
-- Migration: 021_business_rule_rpcs.sql
-- Depends on:
--   001_foundation.sql              -> profiles, is_admin(), set_updated_at()
--   008_orders.sql                  -> orders, order_status_history
--   009_payments.sql                -> payments
--   010_reviews.sql                 -> reviews, recalculate_creator_rating()
--   019_refunds_disputes_payouts.sql -> refund_requests, disputes,
--                                      current_profile_id()
-- Purpose: Enforce critical multi-step business rules atomically at the
--          database level via security-definer functions.
--          The TypeScript service layer delegates to these RPCs instead of
--          manually performing the validations itself.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. public.create_review_for_completed_order_atomic
--
--    Creates a review ONLY when:
--      - Caller is the buyer of the order.
--      - Order status = 'completed'.
--      - Payment status = 'paid'.
--      - Order is not soft-deleted.
--      - No review already exists for this order.
--    Supports all optional sub-ratings and a media attachment.
--    Rating aggregation is handled by the existing DB trigger.
-- ---------------------------------------------------------------------------

create or replace function public.create_review_for_completed_order_atomic(
  p_order_id             uuid,
  p_rating               integer,
  p_comment              text    default null,
  p_quality_rating       integer default null,
  p_communication_rating integer default null,
  p_delivery_rating      integer default null,
  p_media_id             uuid    default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_order      public.orders%rowtype;
  v_review     public.reviews%rowtype;
begin
  -- 1. Resolve the current active profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated or your account is not active'
      using errcode = 'P0001';
  end if;

  -- 2. Fetch order; must exist and not be soft-deleted
  select * into v_order
  from public.orders
  where id = p_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  -- 3. Only the buyer of this order can review
  if v_order.buyer_id <> v_profile_id then
    raise exception 'Only the buyer of this order can submit a review'
      using errcode = 'P0003';
  end if;

  -- 4. Order must be completed
  if v_order.order_status <> 'completed' then
    raise exception 'You can only review a completed order (current status: %)',
      v_order.order_status
      using errcode = 'P0004';
  end if;

  -- 5. Payment must be paid
  if v_order.payment_status <> 'paid' then
    raise exception 'You can only review an order whose payment has been confirmed'
      using errcode = 'P0005';
  end if;

  -- 6. Validate rating range
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5'
      using errcode = 'P0006';
  end if;

  -- Validate optional sub-ratings
  if p_quality_rating is not null and (p_quality_rating < 1 or p_quality_rating > 5) then
    raise exception 'Quality rating must be between 1 and 5'
      using errcode = 'P0006';
  end if;
  if p_communication_rating is not null and (p_communication_rating < 1 or p_communication_rating > 5) then
    raise exception 'Communication rating must be between 1 and 5'
      using errcode = 'P0006';
  end if;
  if p_delivery_rating is not null and (p_delivery_rating < 1 or p_delivery_rating > 5) then
    raise exception 'Delivery rating must be between 1 and 5'
      using errcode = 'P0006';
  end if;

  -- 7. Prevent duplicate review (unique index also enforces, but give a clear message)
  if exists (
    select 1
    from public.reviews
    where order_id = p_order_id
      and deleted_at is null
  ) then
    raise exception 'A review has already been submitted for this order'
      using errcode = 'P0007';
  end if;

  -- 8. Insert the review
  insert into public.reviews (
    order_id,
    buyer_id,
    creator_id,
    listing_id,
    rating,
    quality_rating,
    communication_rating,
    delivery_rating,
    comment,
    media_id,
    is_hidden
  )
  values (
    p_order_id,
    v_profile_id,
    v_order.creator_id,
    v_order.listing_id,
    p_rating,
    p_quality_rating,
    p_communication_rating,
    p_delivery_rating,
    p_comment,
    p_media_id,
    false
  )
  returning * into v_review;

  -- Rating aggregation is performed automatically by
  -- the recalculate_creator_rating_trigger on public.reviews.

  return v_review;
end;
$$;

revoke all on function public.create_review_for_completed_order_atomic(
  uuid, integer, text, integer, integer, integer, uuid
) from public;

grant execute on function public.create_review_for_completed_order_atomic(
  uuid, integer, text, integer, integer, integer, uuid
) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. public.update_order_status_atomic
--
--    Transitions an order to a new status based on p_action.
--    Rules enforced:
--      - Buyer can: cancel (unpaid/pending orders), mark_completed (after delivered).
--      - Creator can: mark_accepted, mark_in_progress, mark_shipped, mark_delivered.
--      - Validates old_status → new_status transitions.
--      - Locks the order row FOR UPDATE to prevent race conditions.
--      - Inserts a row into order_status_history.
--    Returns the updated order row.
-- ---------------------------------------------------------------------------

create or replace function public.update_order_status_atomic(
  p_order_id uuid,
  p_action   text,
  p_note     text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id      uuid;
  v_creator_profile public.creator_profiles%rowtype;
  v_order           public.orders%rowtype;
  v_old_status      text;
  v_new_status      text;
  v_is_buyer        boolean := false;
  v_is_creator      boolean := false;
begin
  -- 1. Resolve the current active profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated or your account is not active'
      using errcode = 'P0001';
  end if;

  -- 2. Lock the order row to prevent concurrent status changes
  select * into v_order
  from public.orders
  where id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  v_old_status := v_order.order_status;

  -- 3. Determine whether the caller is the buyer or the assigned creator
  if v_order.buyer_id = v_profile_id then
    v_is_buyer := true;
  end if;

  select * into v_creator_profile
  from public.creator_profiles
  where id = v_order.creator_id
    and user_id = v_profile_id
    and deleted_at is null;

  if found then
    v_is_creator := true;
  end if;

  if not v_is_buyer and not v_is_creator then
    raise exception 'You do not have permission to update this order'
      using errcode = 'P0003';
  end if;

  -- 4. Apply action-specific role and transition validation, then set new status
  case p_action

    when 'cancel' then
      if not v_is_buyer then
        raise exception 'Only the buyer can cancel an order'
          using errcode = 'P0003';
      end if;
      if v_order.payment_status not in ('created', 'pending') then
        raise exception 'Cannot cancel an order that has already been paid'
          using errcode = 'P0008';
      end if;
      if v_old_status not in ('draft', 'requested', 'payment_pending', 'accepted') then
        raise exception 'Cannot cancel an order with status "%"', v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'cancelled';

    when 'mark_completed' then
      if not v_is_buyer then
        raise exception 'Only the buyer can mark an order as completed'
          using errcode = 'P0003';
      end if;
      if v_old_status <> 'delivered' then
        raise exception 'Cannot complete an order that has not been delivered (current status: %)',
          v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'completed';

    when 'mark_accepted' then
      if not v_is_creator then
        raise exception 'Only the assigned creator can accept an order'
          using errcode = 'P0003';
      end if;
      if v_old_status not in ('payment_pending', 'requested') then
        raise exception 'Cannot accept an order with status "%"', v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'accepted';

    when 'mark_in_progress' then
      if not v_is_creator then
        raise exception 'Only the assigned creator can mark an order as in progress'
          using errcode = 'P0003';
      end if;
      if v_old_status not in ('accepted', 'paid') then
        raise exception 'Cannot move to in_progress from status "%"', v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'in_progress';

    when 'mark_shipped' then
      if not v_is_creator then
        raise exception 'Only the assigned creator can mark an order as shipped'
          using errcode = 'P0003';
      end if;
      if v_old_status <> 'in_progress' then
        raise exception 'Cannot mark shipped from status "%"', v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'shipped';

    when 'mark_delivered' then
      if not v_is_creator then
        raise exception 'Only the assigned creator can mark an order as delivered'
          using errcode = 'P0003';
      end if;
      if v_old_status <> 'shipped' then
        raise exception 'Cannot mark delivered from status "%"', v_old_status
          using errcode = 'P0009';
      end if;
      v_new_status := 'delivered';

    else
      raise exception 'Unknown action: "%"', p_action
        using errcode = 'P0010';
  end case;

  -- 5. Update the order status
  update public.orders
  set order_status = v_new_status
  where id = p_order_id
  returning * into v_order;

  -- 6. Insert status history (using v_old_status captured before the update)
  insert into public.order_status_history (
    order_id,
    old_status,
    new_status,
    changed_by,
    note
  )
  values (
    p_order_id,
    v_old_status,
    v_new_status,
    v_profile_id,
    p_note
  );

  return v_order;
end;
$$;

revoke all on function public.update_order_status_atomic(uuid, text, text) from public;
grant execute on function public.update_order_status_atomic(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. public.create_refund_request_atomic
--
--    Creates a refund request ONLY when:
--      - Caller is the buyer of the order.
--      - Order payment_status is 'paid' or 'partially_refunded'.
--      - Order is not cancelled or refunded.
--      - Payment belongs to the order and is in a refundable state.
--      - Requested amount > 0 and <= payment amount.
--      - No active ('requested' or 'approved') refund request already exists.
--    Returns the inserted refund_requests row.
-- ---------------------------------------------------------------------------

create or replace function public.create_refund_request_atomic(
  p_order_id    uuid,
  p_payment_id  uuid,
  p_amount      numeric,
  p_reason      text,
  p_description text default null
)
returns public.refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_order      public.orders%rowtype;
  v_payment    public.payments%rowtype;
  v_refund     public.refund_requests%rowtype;
begin
  -- 1. Resolve the current active profile (buyer)
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated or your account is not active'
      using errcode = 'P0001';
  end if;

  -- 2. Fetch order; must belong to this buyer and not be deleted
  select * into v_order
  from public.orders
  where id = p_order_id
    and buyer_id = v_profile_id
    and deleted_at is null;

  if not found then
    raise exception 'Order not found or does not belong to you'
      using errcode = 'P0002';
  end if;

  -- 3. Order payment must be paid or partially refunded
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Refunds can only be requested for paid orders (current payment status: %)',
      v_order.payment_status
      using errcode = 'P0008';
  end if;

  -- 4. Order must not be already cancelled or fully refunded
  if v_order.order_status in ('cancelled', 'refunded') then
    raise exception 'Cannot request a refund for an order with status "%"', v_order.order_status
      using errcode = 'P0009';
  end if;

  -- 5. Verify the payment belongs to this order and is in a refundable state
  select * into v_payment
  from public.payments
  where id = p_payment_id
    and order_id = p_order_id
    and status in ('paid', 'partially_refunded')
    and deleted_at is null;

  if not found then
    raise exception 'Payment not found or is not in a refundable state'
      using errcode = 'P0002';
  end if;

  -- 6. Amount validation
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be greater than 0'
      using errcode = 'P0006';
  end if;

  if p_amount > v_payment.amount then
    raise exception 'Refund amount (%) cannot exceed the original payment amount (%)',
      p_amount, v_payment.amount
      using errcode = 'P0006';
  end if;

  -- 7. Prevent duplicate active refund request for the same order
  if exists (
    select 1
    from public.refund_requests
    where order_id = p_order_id
      and status in ('requested', 'approved')
      and deleted_at is null
  ) then
    raise exception 'An active refund request already exists for this order'
      using errcode = 'P0007';
  end if;

  -- 8. Insert the refund request
  insert into public.refund_requests (
    order_id,
    payment_id,
    buyer_id,
    amount,
    currency,
    reason,
    description,
    status
  )
  values (
    p_order_id,
    p_payment_id,
    v_profile_id,
    p_amount,
    v_order.currency,
    p_reason,
    p_description,
    'requested'
  )
  returning * into v_refund;

  return v_refund;
end;
$$;

revoke all on function public.create_refund_request_atomic(uuid, uuid, numeric, text, text) from public;
grant execute on function public.create_refund_request_atomic(uuid, uuid, numeric, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. public.create_dispute_atomic
--
--    Opens a dispute ONLY when:
--      - Caller is the buyer or the assigned creator of the order.
--      - Order is not cancelled, refunded, or deleted.
--      - No active ('open' or 'under_review') dispute exists for the order.
--    If the order is not already 'disputed', transitions it and inserts a
--    status history row.
--    Returns the inserted disputes row.
-- ---------------------------------------------------------------------------

create or replace function public.create_dispute_atomic(
  p_order_id    uuid,
  p_reason      text,
  p_description text default null
)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id      uuid;
  v_order           public.orders%rowtype;
  v_creator_profile public.creator_profiles%rowtype;
  v_dispute         public.disputes%rowtype;
  v_is_buyer        boolean := false;
  v_is_creator      boolean := false;
begin
  -- 1. Resolve the current active profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated or your account is not active'
      using errcode = 'P0001';
  end if;

  -- 2. Fetch the order
  select * into v_order
  from public.orders
  where id = p_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  -- 3. Determine caller role relative to this order
  if v_order.buyer_id = v_profile_id then
    v_is_buyer := true;
  end if;

  select * into v_creator_profile
  from public.creator_profiles
  where id = v_order.creator_id
    and user_id = v_profile_id
    and deleted_at is null;

  if found then
    v_is_creator := true;
  end if;

  if not v_is_buyer and not v_is_creator then
    raise exception 'Only the buyer or the assigned creator can open a dispute for this order'
      using errcode = 'P0003';
  end if;

  -- 4. Order must be in a disputable state
  if v_order.order_status in ('cancelled', 'refunded', 'draft') then
    raise exception 'Cannot open a dispute for an order with status "%"', v_order.order_status
      using errcode = 'P0009';
  end if;

  -- 5. Prevent duplicate active dispute for this order
  if exists (
    select 1
    from public.disputes
    where order_id = p_order_id
      and status in ('open', 'under_review')
      and deleted_at is null
  ) then
    raise exception 'An active dispute already exists for this order'
      using errcode = 'P0007';
  end if;

  -- 6. Insert the dispute row
  insert into public.disputes (
    order_id,
    opened_by,
    reason,
    description,
    status
  )
  values (
    p_order_id,
    v_profile_id,
    p_reason,
    p_description,
    'open'
  )
  returning * into v_dispute;

  -- 7. If the order is not yet in 'disputed' state, transition it
  if v_order.order_status <> 'disputed' then
    update public.orders
    set order_status = 'disputed'
    where id = p_order_id;

    insert into public.order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      note
    )
    values (
      p_order_id,
      v_order.order_status,
      'disputed',
      v_profile_id,
      'Dispute opened: ' || p_reason
    );
  end if;

  return v_dispute;
end;
$$;

revoke all on function public.create_dispute_atomic(uuid, text, text) from public;
grant execute on function public.create_dispute_atomic(uuid, text, text) to authenticated;


-- =============================================================================
-- End of migration 021_business_rule_rpcs.sql
-- =============================================================================
