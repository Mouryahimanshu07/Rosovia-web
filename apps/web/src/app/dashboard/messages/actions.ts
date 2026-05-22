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

    const { data: creatorProfile } = await supabase
      .from('creator_profiles')
      .select('id, display_name')
      .eq('user_id', user.id)
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

