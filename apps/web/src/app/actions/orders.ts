'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createOrderFromApprovedListing,
  createOrderFromAcceptedCustomOrder,
  updateCurrentUserOrderStatus,
} from '@rosovia/api';
import {
  createListingOrderSchema,
  createCustomOrderOrderSchema,
  orderStatusUpdateSchema,
} from '@rosovia/core';
import type {
  CreateListingOrderInput,
  CreateCustomOrderOrderInput,
  OrderStatusUpdateInput,
  Order,
} from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const revalidateOrderPaths = () => {
  revalidatePath('/dashboard/buyer/orders');
  revalidatePath('/dashboard/creator/orders');
};

// ---------------------------------------------------------------------------
// Create order from approved listing
// ---------------------------------------------------------------------------

export async function createOrderFromListingAction(
  input: CreateListingOrderInput
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = createListingOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const order = await createOrderFromApprovedListing(supabase, parsed.data);
    revalidateOrderPaths();
    revalidatePath('/dashboard/buyer/custom-orders');
    return { success: true, data: { orderId: order.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create order',
    };
  }
}

// ---------------------------------------------------------------------------
// Create order from accepted custom order
// ---------------------------------------------------------------------------

export async function createOrderFromCustomOrderAction(
  input: CreateCustomOrderOrderInput
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = createCustomOrderOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const order = await createOrderFromAcceptedCustomOrder(supabase, parsed.data);
    revalidateOrderPaths();
    revalidatePath('/dashboard/buyer/custom-orders');
    return { success: true, data: { orderId: order.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create order from custom order',
    };
  }
}

// ---------------------------------------------------------------------------
// Update order status (buyer cancel / creator fulfillment / dispute)
// ---------------------------------------------------------------------------

export async function updateOrderStatusAction(
  input: OrderStatusUpdateInput
): Promise<ActionResult<Order>> {
  const parsed = orderStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const order = await updateCurrentUserOrderStatus(supabase, parsed.data);
    revalidateOrderPaths();
    revalidatePath(`/dashboard/buyer/orders/${parsed.data.orderId}`);
    revalidatePath(`/dashboard/creator/orders/${parsed.data.orderId}`);
    return { success: true, data: order };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update order status',
    };
  }
}

import { createAdminSupabaseClient } from '~/lib/supabase/admin';

export async function updateOrderMetadataAction(
  orderId: string,
  metadataChanges: Record<string, any>
): Promise<ActionResult<Order>> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Fetch order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: fetchError?.message || 'Order not found' };
    }

    // Verify user is buyer or creator
    const isBuyer = order.buyer_id === user.id;
    let isCreator = false;

    if (!isBuyer) {
      const { data: creatorProfile } = await supabase
        .from('creator_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (creatorProfile && order.creator_id === creatorProfile.id) {
        isCreator = true;
      }
    }

    if (!isBuyer && !isCreator) {
      return { success: false, error: 'Not authorized to update this order' };
    }

    // Prepare updated metadata
    const existingMetadata = order.metadata || {};
    const newMetadata = {
      ...existingMetadata,
      ...metadataChanges,
    };

    // Update using admin client to bypass client RLS update restrictions
    const adminSupabase = createAdminSupabaseClient();
    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update({ metadata: newMetadata })
      .eq('id', orderId)
      .select('*')
      .single();

    if (updateError || !updatedOrder) {
      return { success: false, error: updateError?.message || 'Failed to update order metadata' };
    }

    revalidateOrderPaths();
    revalidatePath(`/dashboard/buyer/orders/${orderId}`);
    revalidatePath(`/dashboard/creator/orders/${orderId}`);

    return { success: true, data: updatedOrder as Order };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

