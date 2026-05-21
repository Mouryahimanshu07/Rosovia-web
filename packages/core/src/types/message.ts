// Messaging types for Rosovia

export interface Conversation {
  id: string;
  buyer_id: string;
  creator_id: string;
  order_id: string | null;
  inquiry_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ConversationWithDetails extends Conversation {
  buyer_full_name: string | null;
  buyer_username: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageWithSender extends Message {
  sender_full_name: string | null;
  sender_username: string | null;
  sender_role: string;
}

export interface CreateConversationInput {
  creatorId: string;
  orderId?: string | null;
  inquiryId?: string | null;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
}
