import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Order,
  OrderWithDetails,
  OrderListParams,
  CreateListingOrderInput,
  CreateCustomOrderOrderInput,
  OrderStatusUpdateInput,
  OrderStatus,
} from '@rosovia/core';
import {
  calculatePlatformFee,
  calculateSellerAmount,
} from '@rosovia/core';

import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getOrderById,
  getOrderByCustomOrderId,
  createOrder,
  listCurrentBuyerOrders,
  listCurrentCreatorOrders,
  getOrderForBuyer,
  getOrderForCreator,
  listOrderStatusHistory,
} from './order.repository';

export {
  listCurrentBuyerOrders,
  listCurrentCreatorOrders,
  listOrderStatusHistory,
};

// ---------------------------------------------------------------------------
// Internal: resolve active profile from auth session
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

// ---------------------------------------------------------------------------
// Internal: resolve active creator profile for the calling user
// ---------------------------------------------------------------------------

async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'creator') {
    throw new Error('Only creators can manage orders from the creator dashboard');
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
// Internal: normalize RPC order result
// ---------------------------------------------------------------------------

function normalizeCreatedOrderFromRpc(data: unknown): Order {
  if (!data) {
    throw new Error('Order creation failed');
  }

  if (Array.isArray(data)) {
    if (!data[0]) {
      throw new Error('Order creation failed');
    }

    return data[0] as Order;
  }

  return data as Order;
}

// ---------------------------------------------------------------------------
// Buyer: create order from an approved listing
// Uses DB RPC for atomic stock reservation + order creation.
// ---------------------------------------------------------------------------

export async function createOrderFromApprovedListing(
  supabase: SupabaseClient,
  input: CreateListingOrderInput
): Promise<Order> {
  await resolveActiveProfile(supabase);

  const { data, error } = await supabase.rpc('create_listing_order_atomic', {
    p_listing_id: input.listingId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeCreatedOrderFromRpc(data);
}

// ---------------------------------------------------------------------------
// Buyer: create order from an accepted custom order
// ---------------------------------------------------------------------------

export async function createOrderFromAcceptedCustomOrder(
  supabase: SupabaseClient,
  input: CreateCustomOrderOrderInput
): Promise<Order> {
  const profile = await resolveActiveProfile(supabase);

  const { data: customOrder, error: coError } = await supabase
    .from('custom_orders')
    .select('id, buyer_id, creator_id, status, creator_quote_amount, deleted_at')
    .eq('id', input.customOrderId)
    .is('deleted_at', null)
    .single();

  if (coError || !customOrder) {
    throw new Error('Custom order not found');
  }

  const co = customOrder as {
    id: string;
    buyer_id: string;
    creator_id: string;
    status: string;
    creator_quote_amount: number | null;
  };

  if (co.buyer_id !== profile.id) {
    throw new Error('This custom order does not belong to you');
  }

  if (co.status !== 'accepted') {
    throw new Error('An order can only be created for an accepted custom order quote');
  }

  if (co.creator_quote_amount === null || co.creator_quote_amount <= 0) {
    throw new Error('Custom order does not have a valid quote amount');
  }

  const existingOrder = await getOrderByCustomOrderId(supabase, co.id);

  if (existingOrder) {
    throw new Error('An order already exists for this custom order');
  }

  const amount = co.creator_quote_amount;
  const platformFee = calculatePlatformFee(amount);
  const sellerAmount = calculateSellerAmount(amount, platformFee);

  const order = await createOrder(supabase, {
    buyer_id: profile.id,
    creator_id: co.creator_id,
    listing_id: null,
    custom_order_id: co.id,
    amount,
    platform_fee: platformFee,
    seller_amount: sellerAmount,
    currency: 'INR',
    order_status: 'payment_pending',
    payment_status: 'created',
  });

  return order;
}

// ---------------------------------------------------------------------------
// Buyer: list own orders
// ---------------------------------------------------------------------------

export async function listBuyerOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: OrderListParams = {}
): Promise<OrderWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);

  return listCurrentBuyerOrders(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// Creator: list assigned orders
// ---------------------------------------------------------------------------

export async function listCreatorOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: OrderListParams = {}
): Promise<OrderWithDetails[]> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  return listCurrentCreatorOrders(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Buyer or Creator: get order detail
// ---------------------------------------------------------------------------

export async function getCurrentUserOrderDetail(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderWithDetails | null> {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role === 'creator') {
    const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);

    if (creatorProfile) {
      const order = await getOrderForCreator(
        supabase,
        orderId,
        creatorProfile.id
      );

      if (order) {
        return order;
      }
    }
  }

  return getOrderForBuyer(supabase, orderId, profile.id);
}

// ---------------------------------------------------------------------------
// Status update — delegates all transition validation to the DB RPC
// public.update_order_status_atomic (migration 021).
//
// The RPC enforces:
//   - Active profile resolution via auth.uid().
//   - Role-based action restrictions (buyer vs creator).
//   - Valid old_status → new_status transitions.
//   - Row locking (FOR UPDATE) to prevent race conditions.
//   - Inserts a row into order_status_history.
//
// Narrow cast on supabase.rpc is required because migration 021 RPCs are not
// yet reflected in database.types.ts. Remove once types are regenerated.
// ---------------------------------------------------------------------------

export async function updateCurrentUserOrderStatus(
  supabase: SupabaseClient,
  input: OrderStatusUpdateInput
): Promise<Order> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    'update_order_status_atomic',
    {
      p_order_id: input.orderId,
      p_action: input.action,
      p_note: input.note ?? null,
    }
  ) as { data: Order | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Order status update failed');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Re-export raw helpers for SSR pages
// ---------------------------------------------------------------------------

export {
  getOrderForBuyer,
  getOrderForCreator,
  getOrderById,
};