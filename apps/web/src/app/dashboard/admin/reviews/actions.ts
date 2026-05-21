'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { moderateReviewAsAdmin } from '@rosovia/api';
import { adminReviewModerationSchema } from '@rosovia/core';
import type { AdminReviewModerationInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

export async function moderateReviewAction(
  input: AdminReviewModerationInput
): Promise<ActionResult> {
  const parsed = adminReviewModerationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();
    await moderateReviewAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/reviews');
    revalidatePath('/creators', 'layout');
    revalidatePath('/listings', 'layout');

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to moderate review' };
  }
}
