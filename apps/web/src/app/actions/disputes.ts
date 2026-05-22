'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { createDisputeForOrder } from '@rosovia/api';
import { disputeCreateSchema } from '@rosovia/core';
import type { CreateDisputeInput, Dispute } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Buyer or Creator: Open a dispute on an order
// All business rules (duplicate check, order state, ownership) are enforced
// atomically in the DB by the create_dispute_atomic RPC.
// ---------------------------------------------------------------------------

export async function createDisputeAction(
  input: CreateDisputeInput
): Promise<ActionResult<Dispute>> {
  const parsed = disputeCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const dispute = await createDisputeForOrder(supabase, parsed.data);

    // Revalidate order detail pages so status updates are reflected
    revalidatePath('/dashboard/buyer/orders');
    revalidatePath(`/dashboard/buyer/orders/${parsed.data.orderId}`);
    revalidatePath('/dashboard/creator/orders');
    revalidatePath(`/dashboard/creator/orders/${parsed.data.orderId}`);

    return { success: true, data: dispute };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to open dispute',
    };
  }
}
