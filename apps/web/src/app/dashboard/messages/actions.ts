'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  sendCurrentUserMessage,
  getOrCreateConversationForCurrentUser,
} from '@rosovia/api';
import { messageSendSchema, conversationCreateSchema } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function sendMessageAction(
  conversationId: string,
  body: string
): Promise<ActionResult> {
  const parsed = messageSendSchema.safeParse({ conversationId, body });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid message content',
    };
  }

  try {
    const supabase = createWebServerClient();
    await sendCurrentUserMessage(supabase, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
    });
    revalidatePath(`/dashboard/messages`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send message',
    };
  }
}

export async function startConversationAction(
  creatorId: string,
  orderId?: string | null,
  inquiryId?: string | null
): Promise<ActionResult<string>> {
  const parsed = conversationCreateSchema.safeParse({ creatorId, orderId, inquiryId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid conversation input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const conversation = await getOrCreateConversationForCurrentUser(supabase, {
      creatorId: parsed.data.creatorId,
      orderId: parsed.data.orderId,
      inquiryId: parsed.data.inquiryId,
    });
    
    revalidatePath(`/dashboard/messages`);
    return { success: true, data: conversation.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start conversation',
    };
  }
}
