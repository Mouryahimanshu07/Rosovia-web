import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreatorShipInput,
  CreatorDeliverInput,
  BuyerConfirmDeliveryInput,
  OrderDelivery,
} from '@rosovia/core';
import {
  creatorShipSchema,
  creatorDeliverSchema,
  buyerConfirmDeliverySchema,
} from '@rosovia/core';

import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { getOrderById, updateCurrentUserOrderStatus } from '../orders/order.service';
import {
  getDeliveryByOrderId,
  upsertDelivery,
  updateDeliveryFields,
} from './delivery.repository';

// ---------------------------------------------------------------------------
// Internal Profile Resolution Helpers
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const profile = await getProfileByAuthUserId(supabase, user.id);

  if (!profile) {
    throw new Error('Profile not found');
  }

  if (profile.status !== 'active') {
    throw new Error('Your account is not active');
  }

  return profile;
}

async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'creator') {
    throw new Error('Only creators can perform this action');
  }

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);

  if (!creatorProfile) {
    throw new Error(
      'Creator profile not found. Please complete your creator profile first.'
    );
  }

  return {
    profile,
    creatorProfile,
  };
}

// ---------------------------------------------------------------------------
// Creator: Ship Order
// ---------------------------------------------------------------------------

export async function shipOrder(
  supabase: SupabaseClient,
  input: CreatorShipInput
): Promise<OrderDelivery> {
  const parsed = creatorShipSchema.parse(input);
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  // Fetch the order to verify ownership
  const order = await getOrderById(supabase, parsed.orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.creator_id !== creatorProfile.id) {
    throw new Error('You do not have permission to manage this order');
  }

  // Update order status to shipped via the atomic RPC
  await updateCurrentUserOrderStatus(supabase, {
    orderId: parsed.orderId,
    action: 'mark_shipped',
    note: parsed.deliveryNote ?? undefined,
  });

  // Upsert the delivery record with tracking details
  return upsertDelivery(supabase, {
    order_id: parsed.orderId,
    creator_id: order.creator_id,
    buyer_id: order.buyer_id,
    delivery_type: parsed.deliveryType,
    tracking_reference: parsed.trackingReference ?? null,
    delivery_note: parsed.deliveryNote ?? null,
    status: 'shipped',
    shipped_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Creator: Deliver Order
// ---------------------------------------------------------------------------

export async function deliverOrder(
  supabase: SupabaseClient,
  input: CreatorDeliverInput
): Promise<OrderDelivery> {
  const parsed = creatorDeliverSchema.parse(input);
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  // Fetch the order to verify ownership
  const order = await getOrderById(supabase, parsed.orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.creator_id !== creatorProfile.id) {
    throw new Error('You do not have permission to manage this order');
  }

  // Update order status to delivered via the atomic RPC
  await updateCurrentUserOrderStatus(supabase, {
    orderId: parsed.orderId,
    action: 'mark_delivered',
    note: parsed.deliveryNote ?? undefined,
  });

  // Update the delivery record status and delivered_at timestamp
  return updateDeliveryFields(supabase, parsed.orderId, {
    status: 'delivered',
    delivered_at: new Date().toISOString(),
    delivery_note: parsed.deliveryNote ?? null,
  });
}

// ---------------------------------------------------------------------------
// Buyer: Confirm Delivery / Complete Order
// ---------------------------------------------------------------------------

export async function buyerConfirmDelivery(
  supabase: SupabaseClient,
  input: BuyerConfirmDeliveryInput
): Promise<OrderDelivery> {
  const parsed = buyerConfirmDeliverySchema.parse(input);
  const profile = await resolveActiveProfile(supabase);

  // Fetch the order to verify ownership
  const order = await getOrderById(supabase, parsed.orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.buyer_id !== profile.id) {
    throw new Error('You do not have permission to manage this order');
  }

  // Update order status to completed via the atomic RPC
  await updateCurrentUserOrderStatus(supabase, {
    orderId: parsed.orderId,
    action: 'mark_completed',
  });

  // Update the delivery record status and buyer_confirmed_at timestamp
  return updateDeliveryFields(supabase, parsed.orderId, {
    status: 'buyer_confirmed',
    buyer_confirmed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Get Delivery Detail
// ---------------------------------------------------------------------------

export async function getDeliveryDetail(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderDelivery | null> {
  const profile = await resolveActiveProfile(supabase);
  const delivery = await getDeliveryByOrderId(supabase, orderId);

  if (!delivery) {
    return null;
  }

  // Allow admin
  if (profile.role === 'admin') {
    return delivery;
  }

  // Allow buyer
  if (delivery.buyer_id === profile.id) {
    return delivery;
  }

  // Allow creator
  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (creatorProfile && delivery.creator_id === creatorProfile.id) {
    return delivery;
  }

  throw new Error('You do not have permission to view this delivery');
}
