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

/**
 * Lists all conversations for a profile, enriched with participant info,
 * last message, unread counts, and custom order context.
 *
 * FIX NOTE: We intentionally do NOT embed `custom_orders` inside the main
 * SELECT string. Migration 043 added `custom_orders.conversation_id → conversations`
 * and migration 065 added `conversations.custom_order_id → custom_orders`,
 * creating two FK relationships in opposite directions between the same tables.
 * PostgREST raises "Could not embed because more than one relationship was found"
 * when it sees both. Custom order data is fetched via a separate bulk query
 * that uses the canonical `custom_orders.conversation_id` FK, which is the
 * one actually written by custom-order.service.ts.
 */
export async function listConversationsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  isCreator?: boolean | null
): Promise<ConversationWithDetails[]> {
  // ── Step 1: Fetch conversations ──────────────────────────────────────────
  // Use explicit FK hint for profiles to disambiguate between buyer_id and
  // buyer_profile_id (both are FKs from conversations → profiles).
  let query = supabase
    .from('conversations')
    .select(
      '*, ' +
      'profiles!conversations_buyer_id_fkey ( full_name, username ), ' +
      'creator_profiles ( display_name, slug ), ' +
      'listings ( title, cover_image_url )'
    )
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
    // buyer_id is always populated (non-nullable) — safe to filter by it
    query = query.eq('buyer_id', profileId);
  } else {
    // Generic participant view: buyer_id is always set; seller_profile_id
    // is set by migration 065 backfill + maintained by createConversation.
    query = query.or(`buyer_id.eq.${profileId},seller_profile_id.eq.${profileId}`);
  }

  const { data: conversations, error } = await query.order('last_message_at', {
    ascending: false,
    nullsFirst: false,
  });
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map((c: any) => c.id);

  // ── Step 2: Participant metadata (archive / pin / mute) ──────────────────
  const { data: participantsData } = await supabase
    .from('conversation_participants')
    .select('*')
    .in('conversation_id', conversationIds)
    .eq('profile_id', profileId);

  // ── Step 3: Last messages (bulk, keyed by conversation_id) ───────────────
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
    if (messagesData) lastMessages = messagesData;
  }

  const lastMessageMap: Record<string, any> = {};
  for (const msg of lastMessages) {
    if (!lastMessageMap[msg.conversation_id]) {
      lastMessageMap[msg.conversation_id] = msg;
    }
  }

  // ── Step 4: Unread counts ────────────────────────────────────────────────
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
      unreadCountMap[msg.conversation_id] =
        (unreadCountMap[msg.conversation_id] || 0) + 1;
    }
  }

  // ── Step 5: Custom order data ────────────────────────────────────────────
  // Query via custom_orders.conversation_id (the FK direction actually written
  // by custom-order.service.ts). This completely avoids the bidirectional FK
  // ambiguity that caused the original PostgREST error.
  const customOrderMap: Record<string, { status: string; creator_quote_amount: number | null }> = {};
  const { data: customOrdersData } = await supabase
    .from('custom_orders')
    .select('conversation_id, status, creator_quote_amount')
    .in('conversation_id', conversationIds)
    .is('deleted_at', null);
  if (customOrdersData) {
    for (const co of customOrdersData) {
      customOrderMap[co.conversation_id] = co;
    }
  }

  // ── Step 6: Enrich and return ────────────────────────────────────────────
  const enriched: ConversationWithDetails[] = conversations.map((c: any) => {
    const lastMsg = lastMessageMap[c.id];
    const count = unreadCountMap[c.id] ?? 0;
    const participant = participantsData?.find((p: any) => p.conversation_id === c.id);
    const customOrder = customOrderMap[c.id];

    return {
      ...c,
      buyer_full_name: c.profiles?.full_name ?? null,
      buyer_username: c.profiles?.username ?? null,
      creator_display_name: c.creator_profiles?.display_name ?? null,
      creator_slug: c.creator_profiles?.slug ?? null,
      last_message_body: lastMsg?.body ?? (lastMsg?.attachment_url ? 'Sent an attachment' : null),
      last_message_sender_id: lastMsg?.sender_profile_id ?? null,
      unread_count: count,
      // Participant state
      is_archived: participant?.archived_at != null,
      is_pinned: participant?.pinned_at != null,
      muted_until: participant?.muted_until ?? null,
      last_read_at: participant?.last_read_at ?? null,
      role_in_conversation: participant?.role ?? 'participant',
      // Listing context
      listing_title: c.listings?.title ?? null,
      listing_image_url: c.listings?.cover_image_url ?? null,
      // Custom order context — fetched separately to avoid bidirectional FK ambiguity
      custom_order_status: customOrder?.status ?? null,
      custom_order_price: customOrder?.creator_quote_amount ?? null,
    };
  });

  return enriched;
}

/**
 * Creates a new conversation row.
 *
 * FIX NOTE: Now accepts and persists buyer_profile_id, seller_profile_id, and
 * custom_order_id — columns added by migration 065. Without these, the
 * maintain_conversation_participants trigger fires with NULL profile IDs,
 * creating orphaned participant rows.
 */
export async function createConversation(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    order_id?: string | null;
    inquiry_id?: string | null;
    listing_id?: string | null;
    /** Profile ID of the creator (creator_profiles.user_id). Required for the
     *  conversation_participants trigger introduced in migration 065. */
    seller_profile_id?: string | null;
    /** FK to custom_orders — optional, set when conversation is for a custom order. */
    custom_order_id?: string | null;
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
      // Columns from migration 065 — must be populated for the participants
      // trigger to correctly insert into conversation_participants.
      buyer_profile_id: data.buyer_id,        // buyer_id IS the profile ID
      seller_profile_id: data.seller_profile_id ?? null,
      custom_order_id: data.custom_order_id ?? null,
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

  const { error } = await supabase
    .from('conversation_participants')
    .update({ archived_at: archivedAt })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to archive conversation: ${error.message}`);

  try {
    if (archive) {
      await supabase.rpc('conversation_append_archive', {
        p_convo_id: conversationId,
        p_profile_id: profileId,
      });
    } else {
      await supabase.rpc('conversation_remove_archive', {
        p_convo_id: conversationId,
        p_profile_id: profileId,
      });
    }
  } catch {
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
