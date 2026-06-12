import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Conversation,
  ConversationWithDetails,
  Message,
  MessageWithSender,
} from '@rosovia/core';

// ---------------------------------------------------------------------------
// Conversation Repository Functions
// ---------------------------------------------------------------------------

export async function getConversationById(
  supabase: SupabaseClient,
  id: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch conversation: ${error.message}`);
  }
  return data as Conversation;
}

export async function getConversationByParticipants(
  supabase: SupabaseClient,
  buyerId: string,
  creatorId: string,
  orderId?: string | null,
  inquiryId?: string | null,
  listingId?: string | null
): Promise<Conversation | null> {
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('creator_id', creatorId)
    .is('deleted_at', null);

  if (orderId) {
    query = query.eq('order_id', orderId);
  } else {
    query = query.is('order_id', null);
  }

  if (inquiryId) {
    query = query.eq('inquiry_id', inquiryId);
  } else {
    query = query.is('inquiry_id', null);
  }

  if (listingId) {
    query = query.eq('listing_id', listingId);
  } else {
    query = query.is('listing_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing conversation: ${error.message}`);
  }
  return data as Conversation | null;
}

export async function listConversationsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  isCreator?: boolean | null
): Promise<ConversationWithDetails[]> {
  // 1. Fetch conversations
  let query = supabase
    .from('conversations')
    .select('*, profiles!buyer_id ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title, cover_image_url ), custom_orders!custom_order_id ( status, creator_quote_amount )')
    .is('deleted_at', null);

  if (isCreator === true) {
    const { data: creatorProfile } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('user_id', profileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!creatorProfile) return [];
    query = query.eq('creator_id', creatorProfile.id);
  } else if (isCreator === false) {
    query = query.eq('buyer_id', profileId);
  } else {
    // Fetch all conversations where current user is participant
    query = query.or(`buyer_profile_id.eq.${profileId},seller_profile_id.eq.${profileId}`);
  }

  const { data: conversations, error } = await query.order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  if (!conversations || conversations.length === 0) return [];

  // Fetch participant info for this user to enrich archive/pin/mute states
  const { data: participantsData } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('profile_id', profileId);

  // 2. Fetch last messages & unread counts for all active conversations in bulk
  const conversationIds = conversations.map((c: any) => c.id);
  const lastMessageTimestamps = conversations
    .map((c: any) => c.last_message_at)
    .filter(Boolean);

  let lastMessages: any[] = [];
  if (lastMessageTimestamps.length > 0) {
    const { data: messagesData } = await supabase
      .from('messages')
      .select('conversation_id, body, sender_profile_id, attachment_url, created_at')
      .in('created_at', lastMessageTimestamps)
      .is('deleted_at', null);
    if (messagesData) {
      lastMessages = messagesData;
    }
  }

  const lastMessageMap: Record<string, any> = {};
  for (const msg of lastMessages) {
    lastMessageMap[msg.conversation_id] = msg;
  }

  const { data: unreadCountsData } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds)
    .neq('sender_profile_id', profileId)
    .is('read_at', null)
    .is('deleted_at', null);

  const unreadCountMap: Record<string, number> = {};
  if (unreadCountsData) {
    for (const msg of unreadCountsData) {
      unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
    }
  }

  const enriched: ConversationWithDetails[] = conversations.map((c: any) => {
    const lastMsg = lastMessageMap[c.id];
    const count = unreadCountMap[c.id] ?? 0;
    const participant = participantsData?.find((p: any) => p.conversation_id === c.id);

    return {
      ...c,
      buyer_full_name: c.profiles?.full_name ?? null,
      buyer_username: c.profiles?.username ?? null,
      creator_display_name: c.creator_profiles?.display_name ?? null,
      creator_slug: c.creator_profiles?.slug ?? null,
      last_message_body: lastMsg?.body ?? (lastMsg?.attachment_url ? 'Sent an attachment' : null),
      last_message_sender_id: lastMsg?.sender_profile_id ?? null,
      unread_count: count,
      // New context flags from participants
      is_archived: participant?.archived_at != null,
      is_pinned: participant?.pinned_at != null,
      muted_until: participant?.muted_until ?? null,
      last_read_at: participant?.last_read_at ?? null,
      role_in_conversation: participant?.role ?? 'participant',
      // Context details
      listing_title: c.listings?.title ?? null,
      listing_image_url: c.listings?.cover_image_url ?? null,
      custom_order_status: c.custom_orders?.status ?? null,
      custom_order_price: c.custom_orders?.creator_quote_amount ?? null,
    };
  });

  return enriched;
}

export async function createConversation(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    order_id?: string | null;
    inquiry_id?: string | null;
    listing_id?: string | null;
  }
): Promise<Conversation> {
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      buyer_id: data.buyer_id,
      creator_id: data.creator_id,
      order_id: data.order_id ?? null,
      inquiry_id: data.inquiry_id ?? null,
      listing_id: data.listing_id ?? null,
      last_message_at: null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return created as Conversation;
}

export async function updateConversationLastMessageAt(
  supabase: SupabaseClient,
  conversationId: string,
  timestamp: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ last_message_at: timestamp })
    .eq('id', conversationId);

  if (error) throw new Error(`Failed to update conversation last_message_at: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Message Repository Functions
// ---------------------------------------------------------------------------

export async function listMessagesInConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles ( full_name, username, role )')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list messages: ${error.message}`);

  return (data ?? []).map((m: any) => ({
    ...m,
    sender_full_name: m.profiles?.full_name ?? null,
    sender_username: m.profiles?.username ?? null,
    sender_role: m.profiles?.role ?? 'buyer',
  }));
}

export async function createMessage(
  supabase: SupabaseClient,
  data: {
    conversation_id: string;
    sender_profile_id: string;
    body: string;
    attachment_url?: string | null;
    message_type?: string;
  }
): Promise<Message> {
  const { data: created, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: data.conversation_id,
      sender_profile_id: data.sender_profile_id,
      body: data.body,
      attachment_url: data.attachment_url ?? null,
      message_type: data.message_type ?? 'text',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);
  return created as Message;
}

export async function markMessagesAsRead(
  supabase: SupabaseClient,
  conversationId: string,
  readerProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_profile_id', readerProfileId)
    .is('read_at', null);

  if (error) throw new Error(`Failed to mark messages as read: ${error.message}`);

  // Also update last_read_at in conversation_participants
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', readerProfileId);
}

export async function toggleArchiveConversation(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  archive: boolean
): Promise<void> {
  const archivedAt = archive ? new Date().toISOString() : null;
  
  // Update in participants table
  const { error } = await supabase
    .from('conversation_participants')
    .update({ archived_at: archivedAt })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to archive conversation: ${error.message}`);

  // Maintain array for compatibility if needed
  try {
    if (archive) {
      await supabase.rpc('conversation_append_archive', { 
        p_convo_id: conversationId, 
        p_profile_id: profileId 
      });
    } else {
      await supabase.rpc('conversation_remove_archive', { 
        p_convo_id: conversationId, 
        p_profile_id: profileId 
      });
    }
  } catch (e) {
    // Gracefully ignore if RPC is not defined
  }
}

export async function togglePinConversation(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  pin: boolean
): Promise<void> {
  const pinnedAt = pin ? new Date().toISOString() : null;
  const { error } = await supabase
    .from('conversation_participants')
    .update({ pinned_at: pinnedAt })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to pin conversation: ${error.message}`);
}

export async function updateMuteConversation(
  supabase: SupabaseClient,
  conversationId: string,
  profileId: string,
  until: string | null
): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ muted_until: until })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to mute conversation: ${error.message}`);
}

