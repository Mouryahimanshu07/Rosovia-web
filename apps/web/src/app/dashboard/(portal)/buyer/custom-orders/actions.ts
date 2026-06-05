'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCurrentUserCustomOrder,
  acceptCurrentBuyerCustomOrderQuote,
  cancelCurrentBuyerCustomOrder,
} from '@rosovia/api';
import { customOrderCreateSchema } from '@rosovia/core';
import type { CustomOrderCreateInput } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const revalidateBuyerPaths = () => {
  revalidatePath('/dashboard/buyer/custom-orders');
};

// ---------------------------------------------------------------------------
// Create custom order (buyer)
// ---------------------------------------------------------------------------

export async function createCustomOrderAction(
  input: CustomOrderCreateInput
): Promise<ActionResult> {
  const parsed = customOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    await createCurrentUserCustomOrder(supabase, parsed.data);
    revalidateBuyerPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create custom order',
    };
  }
}

// ---------------------------------------------------------------------------
// Accept quote (buyer)
// ---------------------------------------------------------------------------

export async function acceptQuoteAction(
  customOrderId: string
): Promise<ActionResult> {
  if (!customOrderId) {
    return { success: false, error: 'Custom order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    await acceptCurrentBuyerCustomOrderQuote(supabase, customOrderId);
    revalidateBuyerPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept quote',
    };
  }
}

// ---------------------------------------------------------------------------
// Cancel (buyer)
// ---------------------------------------------------------------------------

export async function cancelCustomOrderAsBuyerAction(
  customOrderId: string
): Promise<ActionResult> {
  if (!customOrderId) {
    return { success: false, error: 'Custom order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    await cancelCurrentBuyerCustomOrder(supabase, customOrderId);
    revalidateBuyerPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to cancel custom order',
    };
  }
}
