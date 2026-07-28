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
  conversation_type?: 'direct' | 'listing' | 'inquiry' | 'custom_order' | 'support';
  buyer_profile_id?: string;
  seller_profile_id?: string;
  listing_id?: string | null;
  custom_order_id?: string | null;
  archived_by?: string[];
  pinned_by?: string[];
  muted_by?: string[];
}

export interface ConversationWithDetails extends Conversation {
  buyer_full_name: string | null;
  buyer_username: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  is_archived: boolean;
  is_pinned: boolean;
  muted_until: string | null;
  last_read_at: string | null;
  role_in_conversation: string;
  // Details from linked context
  listing_title?: string | null;
  listing_image_url?: string | null;
  custom_order_status?: string | null;
  custom_order_price?: number | null;
  creator_primary_category_id?: string | null;
  listing_category_id?: string | null;
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
  attachment_url?: string | null;
  message_type?: string;
  edited_at?: string | null;
  status?: string;
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
  attachmentUrl?: string | null;
  messageType?: string;
}
