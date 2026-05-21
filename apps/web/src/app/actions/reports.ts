'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { createCurrentUserReport } from '@rosovia/api';
import { reportCreateSchema } from '@rosovia/core';
import type { ReportCreateInput, Report } from '@rosovia/core';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Create a new report
// ---------------------------------------------------------------------------

export async function createReportAction(
  input: ReportCreateInput
): Promise<ActionResult<Report>> {
  const parsed = reportCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const report = await createCurrentUserReport(supabase, parsed.data);

    // Revalidate the buyer dashboard where reports are listed
    revalidatePath('/dashboard/buyer/reports');

    // Also revalidate admin dashboard to reflect the new pending report
    revalidatePath('/dashboard/admin/reports');

    return { success: true, data: report };
  } catch (err) {
    captureAppError(err, { module: 'reports', action: 'create_report' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit report',
    };
  }
}
