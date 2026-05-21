-- =============================================================================
-- Rosovia Hardening Migration: 015_security_hardening.sql
-- Purpose:
--   1. Prevent normal users from changing privileged profile fields.
--   2. Prevent creators from forging verification/rating/order counters.
--   3. Replace fragile order update RLS with broad ownership RLS + trigger-enforced
--      status transitions.
--
-- Apply after migrations 001-014.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles: block self privilege changes
-- -----------------------------------------------------------------------------

create or replace function public.prevent_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/server jobs do not have auth.uid(); allow them.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may update privileged fields via admin workflows.
  if public.is_admin() then
    return new;
  end if;

  -- Normal users may update their own editable profile fields only.
  if auth.uid() = old.auth_user_id then
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'You cannot change auth_user_id';
    end if;

    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role';
    end if;

    if new.status is distinct from old.status then
      raise exception 'You cannot change your own account status';
    end if;

    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'You cannot delete or restore your own account directly';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'You cannot change created_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_change on public.profiles;
create trigger prevent_profile_privilege_change
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_change();


-- -----------------------------------------------------------------------------
-- 2. creator_profiles: block creator self-forging of privileged fields
-- -----------------------------------------------------------------------------

create or replace function public.prevent_creator_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
begin
  -- Service-role/server jobs do not have auth.uid(); allow them.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may update verification/rating fields through admin workflows.
  if public.is_admin() then
    return new;
  end if;

  select p.id into caller_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.deleted_at is null
  limit 1;

  -- If the row belongs to the current creator, protect server-controlled fields.
  if caller_profile_id is not null and old.user_id = caller_profile_id then
    if new.user_id is distinct from old.user_id then
      raise exception 'You cannot reassign a creator profile';
    end if;

    if new.is_verified is distinct from old.is_verified then
      raise exception 'You cannot change verification status directly';
    end if;

    if new.verification_level is distinct from old.verification_level then
      raise exception 'You cannot change verification level directly';
    end if;

    if new.rating_avg is distinct from old.rating_avg then
      raise exception 'You cannot change rating average directly';
    end if;

    if new.rating_count is distinct from old.rating_count then
      raise exception 'You cannot change rating count directly';
    end if;

    if new.total_orders is distinct from old.total_orders then
      raise exception 'You cannot change total_orders directly';
    end if;

    if new.total_followers is distinct from old.total_followers then
      raise exception 'You cannot change total_followers directly';
    end if;

    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'You cannot delete or restore your creator profile directly';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'You cannot change created_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_creator_profile_privilege_change on public.creator_profiles;
create trigger prevent_creator_profile_privilege_change
  before update on public.creator_profiles
  for each row execute function public.prevent_creator_profile_privilege_change();


-- -----------------------------------------------------------------------------
-- 3. orders: enforce safe buyer/creator status transitions in DB trigger
-- -----------------------------------------------------------------------------

create or replace function public.guard_order_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
  caller_creator_id uuid;
  is_buyer boolean := false;
  is_creator boolean := false;
begin
  -- Service-role/server jobs do not have auth.uid(); allow webhook/admin server work.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may moderate/fix orders through admin workflows.
  if public.is_admin() then
    return new;
  end if;

  select p.id into caller_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and p.deleted_at is null
  limit 1;

  if caller_profile_id is null then
    raise exception 'Active profile required';
  end if;

  select cp.id into caller_creator_id
  from public.creator_profiles cp
  where cp.user_id = caller_profile_id
    and cp.deleted_at is null
  limit 1;

  is_buyer := old.buyer_id = caller_profile_id;
  is_creator := caller_creator_id is not null and old.creator_id = caller_creator_id;

  if not is_buyer and not is_creator then
    raise exception 'You are not allowed to update this order';
  end if;

  -- Non-admin users cannot change identity/source/financial fields.
  if new.buyer_id is distinct from old.buyer_id
    or new.creator_id is distinct from old.creator_id
    or new.listing_id is distinct from old.listing_id
    or new.custom_order_id is distinct from old.custom_order_id
    or new.amount is distinct from old.amount
    or new.platform_fee is distinct from old.platform_fee
    or new.seller_amount is distinct from old.seller_amount
    or new.currency is distinct from old.currency
    or new.created_at is distinct from old.created_at
    or new.deleted_at is distinct from old.deleted_at
  then
    raise exception 'You cannot change protected order fields';
  end if;

  -- Buyer: payment initiation only moves payment_status to pending.
  if is_buyer
    and old.order_status in ('payment_pending', 'accepted')
    and new.order_status = old.order_status
    and old.payment_status in ('created', 'failed')
    and new.payment_status = 'pending'
    and new.delivery_status is not distinct from old.delivery_status
  then
    return new;
  end if;

  -- Buyer: cancel before successful payment.
  if is_buyer
    and old.order_status in ('requested', 'accepted', 'payment_pending')
    and old.payment_status in ('created', 'pending', 'failed')
    and new.order_status = 'cancelled'
    and new.payment_status = old.payment_status
  then
    return new;
  end if;

  -- Buyer: mark completed after delivery and successful payment.
  if is_buyer
    and old.order_status = 'delivered'
    and old.payment_status = 'paid'
    and new.order_status = 'completed'
    and new.payment_status = 'paid'
  then
    return new;
  end if;

  -- Buyer or creator: open dispute on active order without changing payment status.
  if (is_buyer or is_creator)
    and old.order_status in ('payment_pending', 'accepted', 'paid', 'in_progress', 'shipped', 'delivered')
    and new.order_status = 'disputed'
    and new.payment_status = old.payment_status
  then
    return new;
  end if;

  -- Creator: accept/request progression before payment, if your UX uses this step.
  if is_creator
    and old.order_status in ('requested', 'payment_pending')
    and old.payment_status in ('created', 'pending', 'failed')
    and new.order_status = 'accepted'
    and new.payment_status = old.payment_status
  then
    return new;
  end if;

  -- Creator: start fulfilment only after payment is paid.
  if is_creator
    and old.order_status in ('paid', 'accepted')
    and old.payment_status = 'paid'
    and new.order_status = 'in_progress'
    and new.payment_status = 'paid'
  then
    return new;
  end if;

  -- Creator: ship after in_progress.
  if is_creator
    and old.order_status = 'in_progress'
    and old.payment_status = 'paid'
    and new.order_status = 'shipped'
    and new.payment_status = 'paid'
  then
    return new;
  end if;

  -- Creator: deliver after shipped.
  if is_creator
    and old.order_status = 'shipped'
    and old.payment_status = 'paid'
    and new.order_status = 'delivered'
    and new.payment_status = 'paid'
  then
    return new;
  end if;

  -- Creator: cancel only before successful payment.
  if is_creator
    and old.order_status in ('requested', 'accepted', 'payment_pending')
    and old.payment_status in ('created', 'pending', 'failed')
    and new.order_status = 'cancelled'
    and new.payment_status = old.payment_status
  then
    return new;
  end if;

  raise exception 'Invalid or unsafe order update';
end;
$$;

drop trigger if exists guard_order_user_update on public.orders;
create trigger guard_order_user_update
  before update on public.orders
  for each row execute function public.guard_order_user_update();


-- -----------------------------------------------------------------------------
-- 4. Replace order update RLS policies with ownership policies.
--    The trigger above enforces actual safe transitions and protected fields.
-- -----------------------------------------------------------------------------

drop policy if exists "orders: buyer can cancel own order" on public.orders;
drop policy if exists "orders: creator can update fulfillment" on public.orders;

drop policy if exists "orders: buyer can update own limited" on public.orders;
create policy "orders: buyer can update own limited"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and orders.deleted_at is null
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = orders.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and orders.deleted_at is null
  );


drop policy if exists "orders: creator can update assigned limited" on public.orders;
create policy "orders: creator can update assigned limited"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and orders.deleted_at is null
  )
  with check (
    exists (
      select 1
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = orders.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and cp.deleted_at is null
    )
    and orders.deleted_at is null
  );
