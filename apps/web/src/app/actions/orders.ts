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
