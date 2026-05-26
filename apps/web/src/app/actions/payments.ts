'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { createPaymentForCurrentBuyerOrder } from '@rosovia/api';
import { createPaymentForOrderSchema, isPaymentsEnabled } from '@rosovia/core';
import type { CreatePaymentForOrderInput, RazorpayCheckoutData } from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Initiate payment for an existing order
// Returns Razorpay checkout data to the client.
// The client opens Razorpay Checkout — webhook is the source of truth.
// ---------------------------------------------------------------------------

export async function createPaymentForOrderAction(
  input: CreatePaymentForOrderInput
): Promise<ActionResult<RazorpayCheckoutData>> {
  if (!isPaymentsEnabled()) {
    return {
      success: false,
      error: 'Online payment is currently disabled. You can still contact the creator or request a custom order.',
    };
  }

  const parsed = createPaymentForOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const checkoutData = await createPaymentForCurrentBuyerOrder(supabase, parsed.data);

    // Revalidate order pages so payment_status = pending is reflected
    revalidatePath('/dashboard/buyer/orders');
    revalidatePath(`/dashboard/buyer/orders/${parsed.data.orderId}`);

    return { success: true, data: checkoutData };
  } catch (err) {
    captureAppError(err, { module: 'payments', action: 'create_payment' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to initiate payment',
    };
  }
}
