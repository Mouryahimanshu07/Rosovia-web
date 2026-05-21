'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { moderateReportAsAdmin } from '@rosovia/api';
import { reportModerationSchema } from '@rosovia/core';
import type { ReportModerationInput, Report } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Admin moderation actions on reports
// ---------------------------------------------------------------------------

export async function moderateReportAction(
  input: ReportModerationInput
): Promise<ActionResult<Report>> {
  const parsed = reportModerationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const updated = await moderateReportAsAdmin(supabase, parsed.data);

    // Revalidate admin reports view
    revalidatePath('/dashboard/admin/reports');

    // Depending on the action and target, revalidate public spaces
    // to ensure hidden reviews, suspended listings/creators disappear.
    // It's safest to do a broad layout revalidate for these top-level entities
    if (parsed.data.action === 'hide_review') {
      revalidatePath('/creators', 'layout');
      revalidatePath('/listings', 'layout');
    } else if (parsed.data.action === 'suspend_listing') {
      revalidatePath('/listings', 'layout');
    } else if (parsed.data.action === 'suspend_user') {
      revalidatePath('/creators', 'layout');
    }

    return { success: true, data: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process moderation action',
    };
  }
}
