'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { moderateListingAsAdmin } from '@rosovia/api';
import { adminListingModerationSchema } from '@rosovia/core';
import type { AdminListingModerationInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

export async function moderateListingAction(
  input: AdminListingModerationInput
): Promise<ActionResult> {
  const parsed = adminListingModerationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();
    await moderateListingAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/listings');
    revalidatePath('/listings', 'layout');

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to moderate listing' };
  }
}
