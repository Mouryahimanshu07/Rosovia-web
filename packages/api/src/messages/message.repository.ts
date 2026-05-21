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
  inquiryId?: string | null
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

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing conversation: ${error.message}`);
  }
  return data as Conversation | null;
}

export async function listConversationsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  isCreator: boolean
): Promise<ConversationWithDetails[]> {
  // 1. Fetch conversations
  let query = supabase
    .from('conversations')
    .select('*, profiles ( full_name, username ), creator_profiles ( display_name, slug )')
    .is('deleted_at', null);

  if (isCreator) {
    // If user is creator, creator_profiles user_id must match profileId
    // But since the foreign key creator_id is CP.id, we first need CP.id for CP.user_id = profileId
    const { data: creatorProfile } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('user_id', profileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!creatorProfile) return [];
    query = query.eq('creator_id', creatorProfile.id);
  } else {
    query = query.eq('buyer_id', profileId);
  }

  const { data: conversations, error } = await query.order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  if (!conversations || conversations.length === 0) return [];

  // 2. Fetch last messages & unread counts for all active conversations in parallel
  const enriched: ConversationWithDetails[] = await Promise.all(
    conversations.map(async (c: any) => {
      // Get the last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, sender_profile_id')
        .eq('conversation_id', c.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calculate unread count (messages where sender is NOT this profileId and read_at is null)
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_profile_id', profileId)
        .is('read_at', null)
        .is('deleted_at', null);

      return {
        ...c,
        buyer_full_name: c.profiles?.full_name ?? null,
        buyer_username: c.profiles?.username ?? null,
        creator_display_name: c.creator_profiles?.display_name ?? null,
        creator_slug: c.creator_profiles?.slug ?? null,
        last_message_body: lastMsg?.body ?? null,
        last_message_sender_id: lastMsg?.sender_profile_id ?? null,
        unread_count: count ?? 0,
      };
    })
  );

  return enriched;
}

export async function createConversation(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    order_id?: string | null;
    inquiry_id?: string | null;
  }
): Promise<Conversation> {
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      buyer_id: data.buyer_id,
      creator_id: data.creator_id,
      order_id: data.order_id ?? null,
      inquiry_id: data.inquiry_id ?? null,
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
  }
): Promise<Message> {
  const { data: created, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: data.conversation_id,
      sender_profile_id: data.sender_profile_id,
      body: data.body,
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
}
