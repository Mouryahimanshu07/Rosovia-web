'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  shipOrder,
  deliverOrder,
  buyerConfirmDelivery,
  getDeliveryDetail,
} from '@rosovia/api';
import type {
  CreatorShipInput,
  CreatorDeliverInput,
  BuyerConfirmDeliveryInput,
  OrderDelivery,
} from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const revalidateOrderPaths = (orderId: string) => {
  revalidatePath('/dashboard/buyer/orders');
  revalidatePath(`/dashboard/buyer/orders/${orderId}`);
  revalidatePath('/dashboard/creator/orders');
  revalidatePath(`/dashboard/creator/orders/${orderId}`);
};

// ---------------------------------------------------------------------------
// Creator: Ship an order (with tracking reference & delivery type)
// ---------------------------------------------------------------------------

export async function shipOrderAction(
  input: CreatorShipInput
): Promise<ActionResult<OrderDelivery>> {
  if (!input.orderId) {
    return { success: false, error: 'Order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    const delivery = await shipOrder(supabase, input);
    revalidateOrderPaths(input.orderId);
    return { success: true, data: delivery };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark order as shipped',
    };
  }
}

// ---------------------------------------------------------------------------
// Creator: Mark an order as delivered (with optional delivery note)
// ---------------------------------------------------------------------------

export async function deliverOrderAction(
  input: CreatorDeliverInput
): Promise<ActionResult<OrderDelivery>> {
  if (!input.orderId) {
    return { success: false, error: 'Order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    const delivery = await deliverOrder(supabase, input);
    revalidateOrderPaths(input.orderId);
    return { success: true, data: delivery };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark order as delivered',
    };
  }
}

// ---------------------------------------------------------------------------
// Buyer: Confirm delivery and complete the order (releases escrow)
// ---------------------------------------------------------------------------

export async function buyerConfirmDeliveryAction(
  input: BuyerConfirmDeliveryInput
): Promise<ActionResult<OrderDelivery>> {
  if (!input.orderId) {
    return { success: false, error: 'Order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    const delivery = await buyerConfirmDelivery(supabase, input);
    revalidateOrderPaths(input.orderId);
    return { success: true, data: delivery };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to confirm delivery',
    };
  }
}

// ---------------------------------------------------------------------------
// Shared: Fetch delivery detail (used by both buyer and creator order pages)
// ---------------------------------------------------------------------------

export async function getDeliveryDetailAction(
  orderId: string
): Promise<ActionResult<OrderDelivery | null>> {
  if (!orderId) {
    return { success: false, error: 'Order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    const delivery = await getDeliveryDetail(supabase, orderId);
    return { success: true, data: delivery };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch delivery details',
    };
  }
}
