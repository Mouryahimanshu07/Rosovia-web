import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentUserInquiry,
  replyToCurrentCreatorInquiry,
  closeCurrentUserInquiry,
  updateCurrentCreatorInquiryStatus,
} from '../inquiry.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../../notifications/notification.service';
import {
  createInquiry,
  updateInquiry,
  getInquiryForBuyer,
  getInquiryForCreator,
} from '../inquiry.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn(),
}));

vi.mock('../inquiry.repository', () => ({
  createInquiry: vi.fn(),
  updateInquiry: vi.fn(),
  getInquiryForBuyer: vi.fn(),
  getInquiryForCreator: vi.fn(),
  listCurrentBuyerInquiries: vi.fn(),
  listCurrentCreatorInquiries: vi.fn(),
}));

// Valid v4 UUIDs for tests
const CREATOR_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
const CREATOR_USER_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';
const LISTING_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';
const INQUIRY_ID = '698ad7a0-0435-4309-847e-85e7db0101e4';
const BUYER_ID = 'ad335b1b-f06b-4e1b-90f7-5d2f782c5f1c';

describe('Inquiry Service Hardening & Notifications', () => {
  let mockSupabase: any;
  let mockCreatorSingle: any;
  let mockProfileSingle: any;
  let mockListingSingle: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreatorSingle = vi.fn().mockResolvedValue({
      data: { id: CREATOR_ID, user_id: CREATOR_USER_ID, deleted_at: null },
      error: null,
    });

    mockProfileSingle = vi.fn().mockResolvedValue({
      data: { id: CREATOR_USER_ID, status: 'active', deleted_at: null },
      error: null,
    });

    mockListingSingle = vi.fn().mockResolvedValue({
      data: { id: LISTING_ID, creator_id: CREATOR_ID, status: 'approved', deleted_at: null },
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
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: mockListingSingle,
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
          data: { user: { id: 'buyer_auth_user_id' } },
          error: null,
        }),
      },
    };
  });

  describe('createCurrentUserInquiry', () => {
    it('throws validation error if message is less than 10 characters', async () => {
      await expect(
        createCurrentUserInquiry(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          inquiryType: 'general',
          message: 'Short',
        })
      ).rejects.toThrow('Message must be at least 10 characters');
    });

    it('throws validation error if message is more than 2000 characters', async () => {
      await expect(
        createCurrentUserInquiry(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          inquiryType: 'general',
          message: 'a'.repeat(2001),
        })
      ).rejects.toThrow('Message must be 2000 characters or fewer');
    });

    it('throws validation error if creatorId is not a valid UUID', async () => {
      await expect(
        createCurrentUserInquiry(mockSupabase as SupabaseClient, {
          creatorId: 'invalid-uuid',
          inquiryType: 'general',
          message: 'Valid message content of sufficient length.',
        })
      ).rejects.toThrow('Creator ID must be a valid UUID');
    });

    it('throws validation error if listingId is provided but not a valid UUID', async () => {
      await expect(
        createCurrentUserInquiry(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          listingId: 'invalid-uuid',
          inquiryType: 'general',
          message: 'Valid message content of sufficient length.',
        })
      ).rejects.toThrow('Listing ID must be a valid UUID');
    });

    it('creates an inquiry and dispatches inquiry_received notification successfully', async () => {
      // Mock calling buyer profile resolution
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      // Mock inquiry creation
      const mockCreatedInquiry = {
        id: INQUIRY_ID,
        buyer_id: BUYER_ID,
        creator_id: CREATOR_ID,
        inquiry_type: 'general',
        message: 'Valid message content of sufficient length.',
        status: 'open',
      };
      vi.mocked(createInquiry).mockResolvedValueOnce(mockCreatedInquiry as any);

      const res = await createCurrentUserInquiry(mockSupabase as SupabaseClient, {
        creatorId: CREATOR_ID,
        inquiryType: 'general',
        message: 'Valid message content of sufficient length.',
      });

      expect(res).toEqual(mockCreatedInquiry);
      expect(createInquiry).toHaveBeenCalledWith(mockSupabase, {
        buyer_id: BUYER_ID,
        creator_id: CREATOR_ID,
        listing_id: null,
        inquiry_type: 'general',
        message: 'Valid message content of sufficient length.',
      });

      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: CREATOR_USER_ID, // Creator's user_id
        type: 'inquiry_received',
        title: 'New Inquiry Received',
        body: 'New inquiry of type "general" received from buyer.',
        entityType: 'inquiry',
        entityId: INQUIRY_ID,
      });
    });

    it('throws if buyer tries to send inquiry to themselves', async () => {
      // Creator's user_id is CREATOR_USER_ID
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID, // Same as creator's user_id
        status: 'active',
        role: 'creator',
      } as any);

      await expect(
        createCurrentUserInquiry(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          inquiryType: 'general',
          message: 'Valid message content of sufficient length.',
        })
      ).rejects.toThrow('You cannot send an inquiry to yourself');
    });
  });

  describe('replyToCurrentCreatorInquiry', () => {
    it('throws if response is too short', async () => {
      await expect(
        replyToCurrentCreatorInquiry(mockSupabase as SupabaseClient, {
          inquiryId: INQUIRY_ID,
          creatorResponse: 'a',
        })
      ).rejects.toThrow('Response must be at least 2 characters');
    });

    it('replies and dispatches inquiry_replied notification successfully', async () => {
      // Mock calling creator profile resolution
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID,
        status: 'active',
        role: 'creator',
      } as any);
      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_ID,
        user_id: CREATOR_USER_ID,
      } as any);

      // Mock fetch inquiry for creator
      const mockInquiry = {
        id: INQUIRY_ID,
        buyer_id: BUYER_ID,
        creator_id: CREATOR_ID,
        status: 'open',
      };
      vi.mocked(getInquiryForCreator).mockResolvedValueOnce(mockInquiry as any);

      // Mock update inquiry
      const mockUpdatedInquiry = {
        ...mockInquiry,
        status: 'replied',
        creator_response: 'This is my response from the creator!',
      };
      vi.mocked(updateInquiry).mockResolvedValueOnce(mockUpdatedInquiry as any);

      const res = await replyToCurrentCreatorInquiry(mockSupabase as SupabaseClient, {
        inquiryId: INQUIRY_ID,
        creatorResponse: 'This is my response from the creator!',
      });

      expect(res.status).toBe('replied');
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: BUYER_ID,
        type: 'inquiry_replied',
        title: 'Inquiry Replied',
        body: 'The creator has replied to your inquiry.',
        entityType: 'inquiry',
        entityId: INQUIRY_ID,
      });
    });
  });
});
