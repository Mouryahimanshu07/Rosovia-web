'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { createCategoryAsAdmin, updateCategoryAsAdmin } from '@rosovia/api';
import { adminCategoryCreateSchema, adminCategoryUpdateSchema } from '@rosovia/core';
import type { AdminCategoryCreateInput, AdminCategoryUpdateInput, DbCategory } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createCategoryAction(
  input: AdminCategoryCreateInput
): Promise<ActionResult<DbCategory>> {
  const parsed = adminCategoryCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();
    const category = await createCategoryAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/categories');
    revalidatePath('/explore', 'layout');

    return { success: true, data: category };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create category' };
  }
}

export async function updateCategoryAction(
  input: AdminCategoryUpdateInput
): Promise<ActionResult<DbCategory>> {
  const parsed = adminCategoryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();
    const category = await updateCategoryAsAdmin(supabase, parsed.data);

    revalidatePath('/dashboard/admin/categories');
    revalidatePath('/explore', 'layout');

    return { success: true, data: category };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update category' };
  }
}
