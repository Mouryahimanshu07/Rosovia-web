'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { updateUserStatusAsAdmin } from '@rosovia/api';
import { adminUserStatusUpdateSchema } from '@rosovia/core';
import type { AdminUserStatusUpdateInput, Profile } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function updateUserStatusAction(
  input: AdminUserStatusUpdateInput
): Promise<ActionResult<Profile>> {
  const parsed = adminUserStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();
    const updated = await updateUserStatusAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/users');
    revalidatePath('/dashboard/admin');
    // If user is a creator, revalidate public creator pages
    revalidatePath('/creators', 'layout');

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update user status' };
  }
}
