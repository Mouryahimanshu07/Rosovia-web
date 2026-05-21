'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  markCurrentCreatorCustomOrderReviewing,
  quoteCurrentCreatorCustomOrder,
  rejectCurrentCreatorCustomOrder,
  cancelCurrentCreatorCustomOrder,
} from '@rosovia/api';
import { creatorQuoteCustomOrderSchema } from '@rosovia/core';
import type { CreatorQuoteCustomOrderInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

const revalidateAllPaths = () => {
  revalidatePath('/dashboard/creator/custom-orders');
  revalidatePath('/dashboard/buyer/custom-orders');
};

// ---------------------------------------------------------------------------
// Mark reviewing (creator)
// ---------------------------------------------------------------------------

export async function markReviewingAction(
  customOrderId: string
): Promise<ActionResult> {
  if (!customOrderId) {
    return { success: false, error: 'Custom order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    await markCurrentCreatorCustomOrderReviewing(supabase, customOrderId);
    revalidateAllPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update status',
    };
  }
}

// ---------------------------------------------------------------------------
// Quote (creator)
// ---------------------------------------------------------------------------

export async function quoteCustomOrderAction(
  input: CreatorQuoteCustomOrderInput
): Promise<ActionResult> {
  const parsed = creatorQuoteCustomOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    await quoteCurrentCreatorCustomOrder(supabase, parsed.data);
    revalidateAllPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit quote',
    };
  }
}

// ---------------------------------------------------------------------------
// Reject (creator)
// ---------------------------------------------------------------------------

export async function rejectCustomOrderAction(
  customOrderId: string
): Promise<ActionResult> {
  if (!customOrderId) {
    return { success: false, error: 'Custom order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    await rejectCurrentCreatorCustomOrder(supabase, customOrderId);
    revalidateAllPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reject custom order',
    };
  }
}

// ---------------------------------------------------------------------------
// Cancel (creator)
// ---------------------------------------------------------------------------

export async function cancelCustomOrderAsCreatorAction(
  customOrderId: string
): Promise<ActionResult> {
  if (!customOrderId) {
    return { success: false, error: 'Custom order ID is required' };
  }

  try {
    const supabase = createWebServerClient();
    await cancelCurrentCreatorCustomOrder(supabase, customOrderId);
    revalidateAllPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to cancel custom order',
    };
  }
}
