'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { reviewVerificationRequestAsAdmin } from '@rosovia/api';
import { verificationReviewSchema } from '@rosovia/core';
import type { VerificationReviewInput, VerificationRequest } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Admin: approve or reject a verification request
// ---------------------------------------------------------------------------

export async function reviewVerificationRequestAction(
  input: VerificationReviewInput
): Promise<ActionResult<VerificationRequest>> {
  const parsed = verificationReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const updated = await reviewVerificationRequestAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/verification');
    // Revalidate the creator's public profile so their badge updates
    revalidatePath('/creators', 'layout');

    return { success: true, data: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process verification decision',
    };
  }
}
