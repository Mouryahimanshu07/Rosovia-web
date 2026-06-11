import type { SupabaseClient } from '@supabase/supabase-js';
import {
  customOrderCreateSchema,
  creatorQuoteCustomOrderSchema,
  type CustomOrder,
  type CustomOrderWithDetails,
  type CustomOrderListParams,
  type CustomOrderCreateInput,
  type CreatorQuoteCustomOrderInput,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../notifications/notification.service';
import {
  getCustomOrderForBuyer,
  getCustomOrderForCreator,
  createCustomOrder,
  updateCustomOrder,
  listCurrentBuyerCustomOrders,
  listCurrentCreatorCustomOrders,
} from './custom-order.repository';

export {
  listCurrentBuyerCustomOrders,
  listCurrentCreatorCustomOrders,
};

// ---------------------------------------------------------------------------
// Internal: resolve active base profile from auth session
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// Internal: resolve active creator profile for the calling user
// ---------------------------------------------------------------------------

async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);
  if (profile.role !== 'creator') {
    throw new Error('Only creators can manage custom orders from the creator dashboard');
  }

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) {
    throw new Error('Creator profile not found. Please complete your creator profile first.');
  }

  return { profile, creatorProfile };
}

// ---------------------------------------------------------------------------
// Buyer: create a new custom order
// ---------------------------------------------------------------------------

export async function createCurrentUserCustomOrder(
  supabase: SupabaseClient,
  input: CustomOrderCreateInput
): Promise<CustomOrder> {
  // Rigorous service-layer input validation
  const validatedInput = customOrderCreateSchema.parse(input);

  const profile = await resolveActiveProfile(supabase);

  // Verify target creator exists and is active
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at, accepts_custom_orders')
    .eq('id', validatedInput.creatorId)
    .is('deleted_at', null)
    .single();

  if (creatorError || !creatorData) {
    throw new Error('Creator not found or unavailable');
  }

  const creatorRecord = creatorData as { id: string; user_id: string; accepts_custom_orders: boolean };

  if (creatorRecord.accepts_custom_orders === false) {
    throw new Error('This creator is not currently accepting custom orders');
  }

  // Verify creator's base profile is active
  const { data: creatorBaseProfile, error: baseProfileError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', creatorRecord.user_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (baseProfileError || !creatorBaseProfile) {
    throw new Error('This creator is not currently accepting orders');
  }

  // Buyer cannot send order to themselves
  if (creatorRecord.user_id === profile.id) {
    throw new Error('You cannot send a custom order to yourself');
  }

  // Verify category exists and is active
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('id', validatedInput.categoryId)
    .single();

  if (categoryError || !category) {
    throw new Error('Category not found');
  }
  if (!(category as { is_active: boolean }).is_active) {
    throw new Error('This category is no longer active');
  }

  // Validate listing if provided
  let resolvedCategoryId = validatedInput.categoryId;
  if (validatedInput.listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, creator_id, status, deleted_at, category_id')
      .eq('id', validatedInput.listingId)
      .is('deleted_at', null)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }
    const listingRow = listing as { creator_id: string; status: string; category_id: string | null };
    if (listingRow.status !== 'approved') {
      throw new Error('Custom orders can only be sent for approved listings');
    }
    if (listingRow.creator_id !== validatedInput.creatorId) {
      throw new Error('Listing does not belong to the specified creator');
    }
    // Use listing's category if provided category was not explicit
    if (listingRow.category_id) {
      resolvedCategoryId = listingRow.category_id;
    }
  }

  // Validate reference media if provided: must belong to the buyer
  if (validatedInput.referenceMediaId) {
    const { data: media, error: mediaError } = await supabase
      .from('media_assets')
      .select('id, owner_id')
      .eq('id', validatedInput.referenceMediaId)
      .single();

    if (mediaError || !media) {
      throw new Error('Reference media not found');
    }
    if ((media as { owner_id: string }).owner_id !== profile.id) {
      throw new Error('Reference media does not belong to you');
    }
  }

  const order = await createCustomOrder(supabase, {
    buyer_id: profile.id,
    creator_id: validatedInput.creatorId,
    listing_id: validatedInput.listingId ?? null,
    category_id: resolvedCategoryId,
    title: validatedInput.title,
    description: validatedInput.description,
    reference_media_id: validatedInput.referenceMediaId ?? null,
    budget_min: validatedInput.budgetMin ?? null,
    budget_max: validatedInput.budgetMax ?? null,
    deadline: validatedInput.deadline ?? null,
    delivery_city: validatedInput.deliveryCity ?? null,
    delivery_state: validatedInput.deliveryState ?? null,
  });

  // Link or create a conversation for this custom order request
  try {
    const { getOrCreateConversationForCurrentUser } = await import('../messages/message.service');
    const { createMessage, updateConversationLastMessageAt } = await import('../messages/message.repository');

    const conversation = await getOrCreateConversationForCurrentUser(supabase, {
      creatorId: validatedInput.creatorId,
    });

    // Link conversation_id to the custom order
    await supabase
      .from('custom_orders')
      .update({ conversation_id: conversation.id })
      .eq('id', order.id);

    // Create a system message in the conversation summarizing the custom order
    const systemBody = `📋 Custom Order Requested: "${validatedInput.title}"\n\n${validatedInput.description.substring(0, 200)}${validatedInput.description.length > 200 ? '…' : ''}`;
    const msg = await createMessage(supabase, {
      conversation_id: conversation.id,
      sender_profile_id: profile.id,
      body: systemBody,
    });
    await updateConversationLastMessageAt(supabase, conversation.id, msg.created_at);
  } catch (conversationError) {
    // Non-fatal: custom order still created even if conversation linking fails
    console.error('Failed to link conversation to custom order:', conversationError);
  }

  try {
    await createSystemNotification(supabase, {
      recipientProfileId: creatorRecord.user_id,
      type: 'custom_order_received',
      title: 'New Custom Order Request',
      body: `New custom order request: "${validatedInput.title}".`,
      entityType: 'custom_order',
      entityId: order.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for custom order creation:', notificationError);
  }

  return order;
}


// ---------------------------------------------------------------------------
// Buyer: list own custom orders
// ---------------------------------------------------------------------------

export async function listBuyerCustomOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentBuyerCustomOrders(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// Buyer: accept quote (quoted → accepted)
// ---------------------------------------------------------------------------

export async function acceptCurrentBuyerCustomOrderQuote(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Custom order ID must be a valid UUID').parse(customOrderId);

  const profile = await resolveActiveProfile(supabase);

  const order = await getCustomOrderForBuyer(supabase, validatedId, profile.id);
  if (!order) throw new Error('Custom order not found');
  if (order.status !== 'quoted') {
    throw new Error('You can only accept a quote when the order status is "quoted"');
  }
  if (order.creator_quote_amount === null) {
    throw new Error('Creator has not provided a quote amount yet');
  }

  const updated = await updateCustomOrder(supabase, validatedId, { status: 'accepted' });

  // Notify creator
  try {
    const { data: cp } = await supabase
      .from('creator_profiles')
      .select('user_id')
      .eq('id', order.creator_id)
      .single();
    const creatorProfileId = cp?.user_id;

    if (creatorProfileId) {
      await createSystemNotification(supabase, {
        recipientProfileId: creatorProfileId,
        type: 'custom_order_status_changed',
        title: 'Custom Quote Accepted',
        body: `Buyer accepted your quote for custom order "${order.title}".`,
        entityType: 'custom_order',
        entityId: order.id,
      });
    }
  } catch (notificationError) {
    console.error('Failed to send notification for custom order quote acceptance:', notificationError);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Buyer: cancel own custom order
// ---------------------------------------------------------------------------

export async function cancelCurrentBuyerCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Custom order ID must be a valid UUID').parse(customOrderId);

  const profile = await resolveActiveProfile(supabase);

  const order = await getCustomOrderForBuyer(supabase, validatedId, profile.id);
  if (!order) throw new Error('Custom order not found');

  const cancellableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel a custom order with status "${order.status}"`);
  }

  const updated = await updateCustomOrder(supabase, validatedId, { status: 'cancelled' });

  // Notify creator
  try {
    const { data: cp } = await supabase
      .from('creator_profiles')
      .select('user_id')
      .eq('id', order.creator_id)
      .single();
    const creatorProfileId = cp?.user_id;

    if (creatorProfileId) {
      await createSystemNotification(supabase, {
        recipientProfileId: creatorProfileId,
        type: 'custom_order_status_changed',
        title: 'Custom Order Cancelled',
        body: `Buyer cancelled the custom order "${order.title}".`,
        entityType: 'custom_order',
        entityId: order.id,
      });
    }
  } catch (notificationError) {
    console.error('Failed to send notification for custom order cancellation as buyer:', notificationError);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Creator: list assigned custom orders
// ---------------------------------------------------------------------------

export async function listCreatorCustomOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);
  return listCurrentCreatorCustomOrders(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Creator: mark as reviewing (requested → creator_reviewing)
// ---------------------------------------------------------------------------

export async function markCurrentCreatorCustomOrderReviewing(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Custom order ID must be a valid UUID').parse(customOrderId);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, validatedId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');
  if (order.status !== 'requested') {
    throw new Error('Can only mark an order as reviewing when it is in "requested" status');
  }

  const updated = await updateCustomOrder(supabase, validatedId, { status: 'creator_reviewing' });

  // Notify buyer
  try {
    await createSystemNotification(supabase, {
      recipientProfileId: order.buyer_id,
      type: 'custom_order_status_changed',
      title: 'Custom Order Status Updated',
      body: `Custom order "${order.title}" status changed to "creator_reviewing".`,
      entityType: 'custom_order',
      entityId: order.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for custom order mark reviewing:', notificationError);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Creator: submit quote (requested/creator_reviewing → quoted)
// ---------------------------------------------------------------------------

export async function quoteCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  input: CreatorQuoteCustomOrderInput
): Promise<CustomOrder> {
  const validatedInput = creatorQuoteCustomOrderSchema.parse(input);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, validatedInput.customOrderId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const quotableStatuses: string[] = ['requested', 'creator_reviewing'];
  if (!quotableStatuses.includes(order.status)) {
    throw new Error(`Cannot quote a custom order with status "${order.status}"`);
  }

  const updated = await updateCustomOrder(supabase, validatedInput.customOrderId, {
    status: 'quoted',
    creator_quote_amount: validatedInput.creatorQuoteAmount,
    creator_quote_note: validatedInput.creatorQuoteNote ?? null,
  });

  // Notify buyer
  try {
    await createSystemNotification(supabase, {
      recipientProfileId: order.buyer_id,
      type: 'custom_order_status_changed',
      title: 'Custom Order Quoted',
      body: `Custom order "${order.title}" has been quoted at $${validatedInput.creatorQuoteAmount}.`,
      entityType: 'custom_order',
      entityId: order.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for custom order quote submission:', notificationError);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Creator: reject custom order (requested/creator_reviewing/quoted → rejected)
// ---------------------------------------------------------------------------

export async function rejectCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Custom order ID must be a valid UUID').parse(customOrderId);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, validatedId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const rejectableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!rejectableStatuses.includes(order.status)) {
    throw new Error(`Cannot reject a custom order with status "${order.status}"`);
  }

  const updated = await updateCustomOrder(supabase, validatedId, { status: 'rejected' });

  // Notify buyer
  try {
    await createSystemNotification(supabase, {
      recipientProfileId: order.buyer_id,
      type: 'custom_order_status_changed',
      title: 'Custom Order Rejected',
      body: `Creator has rejected your request for custom order "${order.title}".`,
      entityType: 'custom_order',
      entityId: order.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for custom order rejection:', notificationError);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Creator: cancel custom order (before payment/order stage)
// ---------------------------------------------------------------------------

export async function cancelCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Custom order ID must be a valid UUID').parse(customOrderId);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, validatedId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const cancellableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel a custom order with status "${order.status}"`);
  }

  const updated = await updateCustomOrder(supabase, validatedId, { status: 'cancelled' });

  // Notify buyer
  try {
    await createSystemNotification(supabase, {
      recipientProfileId: order.buyer_id,
      type: 'custom_order_status_changed',
      title: 'Custom Order Cancelled',
      body: `Creator cancelled the custom order "${order.title}".`,
      entityType: 'custom_order',
      entityId: order.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for custom order cancellation as creator:', notificationError);
  }

  return updated;
}

// Re-export raw read helpers for SSR pages
export { getCustomOrderForBuyer, getCustomOrderForCreator };
