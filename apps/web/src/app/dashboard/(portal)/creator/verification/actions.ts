'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { createCurrentCreatorVerificationRequest } from '@rosovia/api';
import { verificationRequestCreateSchema } from '@rosovia/core';
import type { VerificationRequestCreateInput, VerificationRequest } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Creator: submit a verification request
// ---------------------------------------------------------------------------

export async function createVerificationRequestAction(
  input: VerificationRequestCreateInput
): Promise<ActionResult<VerificationRequest>> {
  const parsed = verificationRequestCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const request = await createCurrentCreatorVerificationRequest(supabase, parsed.data);

    revalidatePath('/dashboard/creator/verification');

    return { success: true, data: request };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit verification request',
    };
  }
}
