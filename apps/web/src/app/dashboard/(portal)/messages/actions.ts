'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  sendCurrentUserMessage,
  getOrCreateConversationForCurrentUser,
  toggleArchiveConversation,
  togglePinConversation,
  updateMuteConversation,
  createCurrentUserReport,
} from '@rosovia/api';
import { messageSendSchema, conversationCreateSchema } from '@rosovia/core';
import { headers } from 'next/headers';
import { rateLimit } from '~/lib/rate-limit';

async function checkRateLimit(limit: number) {
  const supabase = createWebServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const identifier = user?.id || headers().get('x-forwarded-for') || '127.0.0.1';
  const limitRes = await rateLimit(identifier, limit, 60000);
  if (!limitRes.success) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
}

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function sendMessageAction(
  conversationId: string,
  body: string,
  attachmentUrl?: string | null
): Promise<ActionResult> {
  const parsed = messageSendSchema.safeParse({ conversationId, body, attachmentUrl });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid message content',
    };
  }

  try {
    await checkRateLimit(30);
    const supabase = createWebServerClient();
    await sendCurrentUserMessage(supabase, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl,
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

import { createAdminSupabaseClient } from '~/lib/supabase/admin';
import {
  acceptCurrentBuyerCustomOrderQuote,
  createOrderFromAcceptedCustomOrder,
} from '@rosovia/api';

export async function generateCustomOfferAction(
  inquiryId: string,
  price: number,
  deliveryDays: number,
  note: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const { data: creatorProfile } = await supabase
      .from('creator_profiles')
      .select('id, display_name')
      .eq('user_id', profile.id)
      .single();

    if (!creatorProfile) {
      return { success: false, error: 'Creator profile not found' };
    }

    const { data: inquiry } = await supabase
      .from('inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('creator_id', creatorProfile.id)
      .single();

    if (!inquiry) {
      return { success: false, error: 'Inquiry not found or does not belong to you' };
    }

    // Resolve category_id
    let categoryId: string | null = null;
    if (inquiry.listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('category_id')
        .eq('id', inquiry.listing_id)
        .single();
      if (listing?.category_id) {
        categoryId = listing.category_id;
      }
    }

    if (!categoryId) {
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (category) {
        categoryId = category.id;
      }
    }

    if (!categoryId) {
      return { success: false, error: 'Could not resolve an active category for this offer' };
    }

    // Title and description constraints
    const title = `Custom Offer - ${creatorProfile.display_name}`;
    let description = note || `Custom commission based on your inquiry.`;
    if (description.length < 20) {
      description = `${description} - Tailored to your requested specifications and creative direction.`;
    }

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + deliveryDays);
    const deadline = deadlineDate.toISOString().split('T')[0];

    // Create the custom order using the admin client to bypass creator-insert RLS policy
    const adminSupabase = createAdminSupabaseClient();
    const { data: customOrder, error: insertError } = await adminSupabase
      .from('custom_orders')
      .insert({
        buyer_id: inquiry.buyer_id,
        creator_id: inquiry.creator_id,
        listing_id: inquiry.listing_id || null,
        category_id: categoryId,
        title,
        description,
        creator_quote_amount: price,
        creator_quote_note: note || null,
        status: 'quoted',
        deadline,
      })
      .select('*')
      .single();

    if (insertError || !customOrder) {
      return { success: false, error: insertError?.message || 'Failed to generate custom offer' };
    }

    // Resolve conversation and send DM proposal message
    const conversation = await getOrCreateConversationForCurrentUser(supabase, {
      creatorId: inquiry.creator_id,
      inquiryId: inquiry.id,
    });

    const offerPayload = {
      customOrderId: customOrder.id,
      price,
      deliveryDays,
      note: note || '',
    };
    const body = `[CUSTOM_OFFER]:${JSON.stringify(offerPayload)}`;

    await sendCurrentUserMessage(supabase, {
      conversationId: conversation.id,
      body,
    });

    revalidatePath(`/dashboard/messages`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

export async function acceptAndCreateCustomOfferOrderAction(
  customOrderId: string
): Promise<ActionResult<string>> {
  try {
    const supabase = createWebServerClient();
    
    // 1. Accept the custom order quote (quoted -> accepted)
    await acceptCurrentBuyerCustomOrderQuote(supabase, customOrderId);

    // 2. Create standard marketplace order atomically (which registers in public.orders)
    const order = await createOrderFromAcceptedCustomOrder(supabase, { customOrderId });

    revalidatePath(`/dashboard/messages`);
    return { success: true, data: order.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept custom offer',
    };
  }
}

export async function archiveConversationAction(
  conversationId: string,
  archive: boolean
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return { success: false, error: 'Profile not found' };

    await toggleArchiveConversation(supabase, conversationId, profile.id, archive);
    revalidatePath(`/dashboard/messages`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive conversation',
    };
  }
}

export async function pinConversationAction(
  conversationId: string,
  pin: boolean
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return { success: false, error: 'Profile not found' };

    await togglePinConversation(supabase, conversationId, profile.id, pin);
    revalidatePath(`/dashboard/messages`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to pin conversation',
    };
  }
}

export async function muteConversationAction(
  conversationId: string,
  until: string | null
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return { success: false, error: 'Profile not found' };

    await updateMuteConversation(supabase, conversationId, profile.id, until);
    revalidatePath(`/dashboard/messages`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mute conversation',
    };
  }
}

export async function blockUserAction(
  targetProfileId: string,
  block: boolean
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return { success: false, error: 'Profile not found' };

    if (block) {
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: profile.id, blocked_id: targetProfileId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', profile.id)
        .eq('blocked_id', targetProfileId);
      if (error) throw new Error(error.message);
    }

    revalidatePath('/dashboard/messages');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle block status',
    };
  }
}

export async function reportMessageAction(
  messageId: string,
  reason: string,
  description: string
): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await createCurrentUserReport(supabase, {
      targetType: 'message',
      targetId: messageId,
      reason: reason as any,
      description: description || undefined,
    });

    revalidatePath('/dashboard/messages');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to report message',
    };
  }
}

