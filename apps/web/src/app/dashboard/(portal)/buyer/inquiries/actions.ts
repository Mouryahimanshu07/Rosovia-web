'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCurrentUserInquiry,
  closeCurrentUserInquiry,
} from '@rosovia/api';
import { inquiryCreateSchema } from '@rosovia/core';
import type { InquiryCreateInput } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createInquiryAction(
  input: InquiryCreateInput
): Promise<ActionResult> {
  const parsed = inquiryCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    await createCurrentUserInquiry(supabase, {
      creatorId: parsed.data.creatorId,
      listingId: parsed.data.listingId,
      inquiryType: parsed.data.inquiryType,
      message: parsed.data.message,
    });
    revalidatePath('/dashboard/buyer/inquiries');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send inquiry',
    };
  }
}

export async function closeInquiryAsBuyerAction(
  inquiryId: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await closeCurrentUserInquiry(supabase, inquiryId);
    revalidatePath('/dashboard/buyer/inquiries');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to close inquiry',
    };
  }
}
