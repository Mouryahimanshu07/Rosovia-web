'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  replyToCurrentCreatorInquiry,
  updateCurrentCreatorInquiryStatus,
} from '@rosovia/api';
import { inquiryReplySchema, inquiryStatusUpdateSchema } from '@rosovia/core';
import type { InquiryReplyInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

const revalidateInquiryPaths = () => {
  revalidatePath('/dashboard/creator/inquiries');
  revalidatePath('/dashboard/buyer/inquiries');
};

export async function replyToInquiryAction(
  input: InquiryReplyInput
): Promise<ActionResult> {
  const parsed = inquiryReplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    await replyToCurrentCreatorInquiry(supabase, {
      inquiryId: parsed.data.inquiryId,
      creatorResponse: parsed.data.creatorResponse,
    });
    revalidateInquiryPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send reply',
    };
  }
}

export async function updateInquiryStatusAction(
  inquiryId: string,
  status: 'closed' | 'spam'
): Promise<ActionResult> {
  const parsed = inquiryStatusUpdateSchema.safeParse({ inquiryId, status });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  // Creator can only set closed or spam via this action
  if (status !== 'closed' && status !== 'spam') {
    return { success: false, error: 'Invalid status for creator action' };
  }

  try {
    const supabase = createWebServerClient();
    await updateCurrentCreatorInquiryStatus(supabase, { inquiryId, status });
    revalidateInquiryPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update inquiry',
    };
  }
}
