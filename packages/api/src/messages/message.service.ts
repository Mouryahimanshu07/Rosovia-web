import type { SupabaseClient } from '@supabase/supabase-js';
import {
  conversationCreateSchema,
  messageSendSchema,
  type Conversation,
  type ConversationWithDetails,
  type Message,
  type MessageWithSender,
  type ConversationCreateInput,
  type MessageSendInput,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getConversationById,
  getConversationByParticipants,
  listConversationsForProfile,
  listMessagesInConversation,
  createConversation,
  createMessage,
  markMessagesAsRead,
  updateConversationLastMessageAt,
} from './message.repository';
import { createSystemNotification } from '../notifications/notification.service';

// ---------------------------------------------------------------------------
// Internal Helper: resolve active authenticated profile
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
// Conversation Services
// ---------------------------------------------------------------------------

/**
 * Gets or creates a conversation between the current user and the target creator.
 * Validates the creator exists and is active.
 * Prevents starting a conversation with oneself.
 */
export async function getOrCreateConversationForCurrentUser(
  supabase: SupabaseClient,
  rawInput: ConversationCreateInput
): Promise<Conversation> {
  const input = conversationCreateSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // 1. Resolve and verify the target creator
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at')
    .eq('id', input.creatorId)
    .is('deleted_at', null)
    .single();

  if (creatorError || !creatorData) {
    throw new Error('Creator not found or unavailable');
  }

  // Verify creator's base profile is active
  const { data: creatorBaseProfile, error: baseProfileError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', creatorData.user_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (baseProfileError || !creatorBaseProfile) {
    throw new Error('This creator is not currently active');
  }

  // Prevent users messaging themselves
  if (creatorData.user_id === profile.id) {
    throw new Error('You cannot start a conversation with yourself');
  }

  // 2. If orderId or inquiryId is provided, verify it exists and belongs to the buyer/creator
  if (input.orderId) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, creator_id')
      .eq('id', input.orderId)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) throw new Error('Associated order not found');
    if (order.buyer_id !== profile.id && order.creator_id !== creatorData.id) {
      throw new Error('You are not authorized to discuss this order');
    }
  }

  if (input.inquiryId) {
    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .select('id, buyer_id, creator_id')
      .eq('id', input.inquiryId)
      .is('deleted_at', null)
      .single();

    if (inquiryError || !inquiry) throw new Error('Associated inquiry not found');
    if (inquiry.buyer_id !== profile.id && inquiry.creator_id !== creatorData.id) {
      throw new Error('You are not authorized to discuss this inquiry');
    }
  }

  // 3. Check for existing conversation with these exact parameters
  const existing = await getConversationByParticipants(
    supabase,
    profile.id,
    creatorData.id,
    input.orderId,
    input.inquiryId
  );

  if (existing) return existing;

  // 4. Create new conversation
  return createConversation(supabase, {
    buyer_id: profile.id,
    creator_id: creatorData.id,
    order_id: input.orderId,
    inquiry_id: input.inquiryId,
  });
}

/**
 * Lists all conversations for the current user based on their active role.
 */
export async function listCurrentUserConversations(
  supabase: SupabaseClient,
  isCreator: boolean
): Promise<ConversationWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listConversationsForProfile(supabase, profile.id, isCreator);
}

// ---------------------------------------------------------------------------
// Message Services
// ---------------------------------------------------------------------------

/**
 * Fetches all messages in a conversation for the current user.
 * Performs authorization checks to ensure the user is part of the conversation.
 * Marks any new messages from the other user as read.
 */
export async function listCurrentUserMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<MessageWithSender[]> {
  const profile = await resolveActiveProfile(supabase);

  // 1. Fetch conversation to verify participation
  const conversation = await getConversationById(supabase, conversationId);
  if (!conversation) throw new Error('Conversation not found');

  // Verify participation
  let isParticipant = conversation.buyer_id === profile.id;
  if (!isParticipant) {
    // If not buyer, check if they are the assigned creator
    const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
    if (creatorProfile && conversation.creator_id === creatorProfile.id) {
      isParticipant = true;
    }
  }

  if (!isParticipant) {
    throw new Error('You are not a participant in this conversation');
  }

  // 2. Fetch all messages
  const messages = await listMessagesInConversation(supabase, conversationId);

  // 3. Mark messages from other user as read asynchronously/separately
  await markMessagesAsRead(supabase, conversationId, profile.id);

  return messages;
}

/**
 * Sends a message in a conversation.
 * Validates message input using messageSendSchema.
 * Updates conversation last_message_at timestamp.
 */
export async function sendCurrentUserMessage(
  supabase: SupabaseClient,
  rawInput: MessageSendInput
): Promise<Message> {
  const input = messageSendSchema.parse(rawInput);
  const profile = await resolveActiveProfile(supabase);

  // 1. Fetch conversation to verify participation
  const conversation = await getConversationById(supabase, input.conversationId);
  if (!conversation) throw new Error('Conversation not found');

  // Verify participation
  let isParticipant = conversation.buyer_id === profile.id;
  let isCreatorParticipant = false;
  let creatorProfileId: string | null = null;

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (creatorProfile && conversation.creator_id === creatorProfile.id) {
    isParticipant = true;
    isCreatorParticipant = true;
    creatorProfileId = creatorProfile.id;
  }

  if (!isParticipant) {
    throw new Error('You are not authorized to post in this conversation');
  }

  // 2. Validate that the target recipient is active (not suspended or deleted)
  let recipientProfileId: string | null = null;
  if (profile.id === conversation.buyer_id) {
    // Current user is buyer, recipient is creator
    const { data: creatorData, error: creatorError } = await supabase
      .from('creator_profiles')
      .select('id, user_id, deleted_at')
      .eq('id', conversation.creator_id)
      .is('deleted_at', null)
      .single();

    if (creatorError || !creatorData) {
      throw new Error('Recipient creator not found or unavailable');
    }

    const { data: creatorBaseProfile, error: baseProfileError } = await supabase
      .from('profiles')
      .select('id, status, deleted_at')
      .eq('id', creatorData.user_id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (baseProfileError || !creatorBaseProfile || creatorBaseProfile.status !== 'active') {
      throw new Error('Recipient creator is not currently active');
    }

    recipientProfileId = creatorData.user_id;
  } else {
    // Current user is creator, recipient is buyer
    const { data: buyerProfile, error: buyerError } = await supabase
      .from('profiles')
      .select('id, status, deleted_at')
      .eq('id', conversation.buyer_id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (buyerError || !buyerProfile || buyerProfile.status !== 'active') {
      throw new Error('Recipient buyer is not currently active');
    }

    recipientProfileId = conversation.buyer_id;
  }

  // 3. Create the message
  const createdMsg = await createMessage(supabase, {
    conversation_id: input.conversationId,
    sender_profile_id: profile.id,
    body: input.body,
  });

  // 4. Update the conversation last_message_at timestamp
  await updateConversationLastMessageAt(supabase, input.conversationId, createdMsg.created_at);

  // 5. Dispatch message_received notification with transaction-safe try/catch
  try {
    if (recipientProfileId) {
      const truncatedBody =
        input.body.length > 60 ? `${input.body.substring(0, 60)}...` : input.body;

      await createSystemNotification(supabase, {
        recipientProfileId,
        type: 'message_received',
        title: 'New Message Received',
        body: truncatedBody,
        entityType: 'conversation',
        entityId: conversation.id,
      });
    }
  } catch (notificationError) {
    console.error('Failed to send notification for message sent:', notificationError);
  }

  return createdMsg;
}
