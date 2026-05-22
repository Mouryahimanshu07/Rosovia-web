'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { moderateDispute } from '@rosovia/api';

type ActionResult = { success: true } | { success: false; error: string };

export async function moderateDisputeAction(data: {
  disputeId: string;
  action: 'under_review' | 'resolve' | 'reject';
  note?: string;
}): Promise<ActionResult> {
  if (!data.disputeId) {
    return { success: false, error: 'Dispute ID is required' };
  }
  if (!['under_review', 'resolve', 'reject'].includes(data.action)) {
    return { success: false, error: 'Invalid action' };
  }

  try {
    const supabase = createWebServerClient();
    await moderateDispute(supabase, data.disputeId, data.action, data.note);

    revalidatePath('/dashboard/admin/disputes');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to moderate dispute' };
  }
}
