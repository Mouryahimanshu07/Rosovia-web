import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getOrCreateConversationForCurrentUser,
  listCurrentUserConversations,
  listCurrentUserMessages,
  sendCurrentUserMessage,
} from '../message.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../../notifications/notification.service';
import {
  getConversationById,
  getConversationByParticipants,
  listConversationsForProfile,
  listMessagesInConversation,
  createConversation,
  createMessage,
  markMessagesAsRead,
  updateConversationLastMessageAt,
} from '../message.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn(),
}));

vi.mock('../message.repository', () => ({
  getConversationById: vi.fn(),
  getConversationByParticipants: vi.fn(),
  listConversationsForProfile: vi.fn(),
  listMessagesInConversation: vi.fn(),
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  markMessagesAsRead: vi.fn(),
  updateConversationLastMessageAt: vi.fn(),
}));

// Valid UUIDs
const BUYER_USER_ID = 'da255cc8-1335-4cb2-87ff-7c66d578dfaa';
const CREATOR_PROFILE_ID = 'e3b88b0d-bbfb-48bb-a084-3c66f578df9e';
const CREATOR_USER_ID = '12345ff0-bc78-4395-9ffb-fa419356cc5c';
const CONVERSATION_ID = '698bd7a0-0435-4309-847e-85e7db0101e4';
const UNRELATED_USER_ID = '444455aa-bbcc-ddee-ff00-112233445566';

describe('Message Service Security & Notifications', () => {
  let mockSupabase: any;
  let mockCreatorSingle: any;
  let mockProfileSingle: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreatorSingle = vi.fn().mockResolvedValue({
      data: { id: CREATOR_PROFILE_ID, user_id: CREATOR_USER_ID, deleted_at: null },
      error: null,
    });

    mockProfileSingle = vi.fn().mockResolvedValue({
      data: { id: CREATOR_USER_ID, status: 'active', deleted_at: null },
      error: null,
    });

    mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: mockCreatorSingle,
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: mockProfileSingle,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth_user_id' } },
          error: null,
        }),
      },
    };
  });

  describe('sendCurrentUserMessage', () => {
    it('throws validation error if body is empty or too long', async () => {
      // Empty message
      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: CONVERSATION_ID,
          body: '',
        })
      ).rejects.toThrow('Message cannot be empty');

      // Too long message (2001 chars)
      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: CONVERSATION_ID,
          body: 'a'.repeat(2001),
        })
      ).rejects.toThrow('Message must be 2000 characters or fewer');
    });

    it('throws validation error if conversationId is not a valid UUID', async () => {
      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: 'invalid-uuid',
          body: 'Valid message body.',
        })
      ).rejects.toThrow('Conversation ID must be a valid UUID');
    });

    it('throws if current user is not a participant in the conversation', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: UNRELATED_USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getConversationById).mockResolvedValueOnce({
        id: CONVERSATION_ID,
        buyer_id: BUYER_USER_ID,
        creator_id: CREATOR_PROFILE_ID,
        deleted_at: null,
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce(null);

      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: CONVERSATION_ID,
          body: 'Hello world!',
        })
      ).rejects.toThrow('You are not authorized to post in this conversation');
    });

    it('succeeds as buyer and dispatches message_received notification to creator user_id', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getConversationById).mockResolvedValueOnce({
        id: CONVERSATION_ID,
        buyer_id: BUYER_USER_ID,
        creator_id: CREATOR_PROFILE_ID,
        deleted_at: null,
      } as any);

      const mockMsg = {
        id: 'msg-uuid-1',
        conversation_id: CONVERSATION_ID,
        sender_profile_id: BUYER_USER_ID,
        body: 'Hello creator! Nice listing you have.',
        created_at: new Date().toISOString(),
      };
      vi.mocked(createMessage).mockResolvedValueOnce(mockMsg as any);

      const res = await sendCurrentUserMessage(mockSupabase as SupabaseClient, {
        conversationId: CONVERSATION_ID,
        body: 'Hello creator! Nice listing you have.',
      });

      expect(res).toEqual(mockMsg);
      expect(createMessage).toHaveBeenCalledWith(mockSupabase, {
        conversation_id: CONVERSATION_ID,
        sender_profile_id: BUYER_USER_ID,
        body: 'Hello creator! Nice listing you have.',
      });

      expect(updateConversationLastMessageAt).toHaveBeenCalledWith(
        mockSupabase,
        CONVERSATION_ID,
        mockMsg.created_at
      );

      // Notification sent to creator
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: CREATOR_USER_ID,
        type: 'message_received',
        title: 'New Message Received',
        body: 'Hello creator! Nice listing you have.',
        entityType: 'conversation',
        entityId: CONVERSATION_ID,
      });
    });

    it('succeeds as creator and dispatches message_received notification to buyer profile id', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID,
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_PROFILE_ID,
        user_id: CREATOR_USER_ID,
      } as any);

      vi.mocked(getConversationById).mockResolvedValueOnce({
        id: CONVERSATION_ID,
        buyer_id: BUYER_USER_ID,
        creator_id: CREATOR_PROFILE_ID,
        deleted_at: null,
      } as any);

      // Recipient buyer profile query
      mockProfileSingle.mockResolvedValueOnce({
        data: { id: BUYER_USER_ID, status: 'active', deleted_at: null },
        error: null,
      });

      const mockMsg = {
        id: 'msg-uuid-2',
        conversation_id: CONVERSATION_ID,
        sender_profile_id: CREATOR_USER_ID,
        body: 'Thank you! Let me know if you want custom work.',
        created_at: new Date().toISOString(),
      };
      vi.mocked(createMessage).mockResolvedValueOnce(mockMsg as any);

      const res = await sendCurrentUserMessage(mockSupabase as SupabaseClient, {
        conversationId: CONVERSATION_ID,
        body: 'Thank you! Let me know if you want custom work.',
      });

      expect(res).toEqual(mockMsg);

      // Notification sent to buyer
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: BUYER_USER_ID,
        type: 'message_received',
        title: 'New Message Received',
        body: 'Thank you! Let me know if you want custom work.',
        entityType: 'conversation',
        entityId: CONVERSATION_ID,
      });
    });

    it('rejects if target creator profile is inactive or deleted', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getConversationById).mockResolvedValueOnce({
        id: CONVERSATION_ID,
        buyer_id: BUYER_USER_ID,
        creator_id: CREATOR_PROFILE_ID,
        deleted_at: null,
      } as any);

      // Creator base profile status suspended/inactive
      mockProfileSingle.mockResolvedValueOnce({
        data: { id: CREATOR_USER_ID, status: 'suspended', deleted_at: null },
        error: null,
      });

      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: CONVERSATION_ID,
          body: 'Hello there',
        })
      ).rejects.toThrow('Recipient creator is not currently active');
    });

    it('rejects if target buyer profile is inactive or deleted', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID,
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_PROFILE_ID,
        user_id: CREATOR_USER_ID,
      } as any);

      vi.mocked(getConversationById).mockResolvedValueOnce({
        id: CONVERSATION_ID,
        buyer_id: BUYER_USER_ID,
        creator_id: CREATOR_PROFILE_ID,
        deleted_at: null,
      } as any);

      // Target buyer profile is suspended/deleted
      mockSupabase.from = vi.fn((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      await expect(
        sendCurrentUserMessage(mockSupabase as SupabaseClient, {
          conversationId: CONVERSATION_ID,
          body: 'Hello buyer!',
        })
      ).rejects.toThrow('Recipient buyer is not currently active');
    });
  });
});
