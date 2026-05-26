import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentUserCustomOrder,
  acceptCurrentBuyerCustomOrderQuote,
  cancelCurrentBuyerCustomOrder,
  markCurrentCreatorCustomOrderReviewing,
  quoteCurrentCreatorCustomOrder,
  rejectCurrentCreatorCustomOrder,
  cancelCurrentCreatorCustomOrder,
} from '../custom-order.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../../notifications/notification.service';
import { createPaymentForCurrentBuyerOrder } from '../../payments/payment.service';
import {
  createCustomOrder,
  updateCustomOrder,
  getCustomOrderForBuyer,
  getCustomOrderForCreator,
} from '../custom-order.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn(),
}));

vi.mock('../custom-order.repository', () => ({
  createCustomOrder: vi.fn(),
  updateCustomOrder: vi.fn(),
  getCustomOrderForBuyer: vi.fn(),
  getCustomOrderForCreator: vi.fn(),
  listCurrentBuyerCustomOrders: vi.fn(),
  listCurrentCreatorCustomOrders: vi.fn(),
}));

// Valid v4 UUIDs for tests
const CREATOR_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
const CREATOR_USER_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';
const CATEGORY_ID = '1298642a-a92c-473d-82d2-8178cd5b6999';
const LISTING_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';
const ORDER_ID = 'c168249a-41e9-44d4-9543-c90a1ab36c5c';
const BUYER_ID = 'ad335b1b-f06b-4e1b-90f7-5d2f782c5f1c';
const REFERENCE_MEDIA_ID = 'ff99a12c-da45-423c-a99f-e30a5f013d56';

describe('Custom Order Service Hardening & Notifications', () => {
  let mockSupabase: any;
  let mockCreatorSingle: any;
  let mockProfileSingle: any;
  let mockCategorySingle: any;
  let mockListingSingle: any;
  let mockMediaSingle: any;

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

    mockCategorySingle = vi.fn().mockResolvedValue({
      data: { id: CATEGORY_ID, is_active: true },
      error: null,
    });

    mockListingSingle = vi.fn().mockResolvedValue({
      data: { id: LISTING_ID, creator_id: CREATOR_ID, status: 'approved', deleted_at: null, category_id: CATEGORY_ID },
      error: null,
    });

    mockMediaSingle = vi.fn().mockResolvedValue({
      data: { id: REFERENCE_MEDIA_ID, owner_id: BUYER_ID },
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
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: mockCategorySingle,
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
        if (table === 'media_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: mockMediaSingle,
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

  describe('createCurrentUserCustomOrder input validation', () => {
    it('throws validation error if title is less than 3 characters', async () => {
      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          title: 'Ab',
          description: 'Valid description that has at least 20 characters in it.',
        })
      ).rejects.toThrow('Title must be at least 3 characters');
    });

    it('throws validation error if description is less than 20 characters', async () => {
      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          title: 'Valid Title',
          description: 'Too short',
        })
      ).rejects.toThrow('Description must be at least 20 characters');
    });

    it('throws validation error if budgetMax is less than budgetMin', async () => {
      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          title: 'Valid Title',
          description: 'Valid description that has at least 20 characters in it.',
          budgetMin: 100,
          budgetMax: 50,
        })
      ).rejects.toThrow('Budget maximum must be greater than or equal to budget minimum');
    });

    it('throws validation error if creatorId is not a valid UUID', async () => {
      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: 'invalid-uuid',
          categoryId: CATEGORY_ID,
          title: 'Valid Title',
          description: 'Valid description that has at least 20 characters in it.',
        })
      ).rejects.toThrow('Creator ID must be a valid UUID');
    });
  });

  describe('Active profile, category, and listing checks', () => {
    it('throws error if target creator base profile is not active', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      mockProfileSingle.mockResolvedValueOnce({
        data: null,
        error: new Error('Not active'),
      });

      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          title: 'Valid Title',
          description: 'Valid description that has at least 20 characters in it.',
        })
      ).rejects.toThrow('This creator is not currently accepting orders');
    });

    it('throws error if category is inactive', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      mockCategorySingle.mockResolvedValueOnce({
        data: { id: CATEGORY_ID, is_active: false },
        error: null,
      });

      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          title: 'Valid Title',
          description: 'Valid description that has at least 20 characters in it.',
        })
      ).rejects.toThrow('This category is no longer active');
    });

    it('throws error if listing is not approved', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      mockListingSingle.mockResolvedValueOnce({
        data: { id: LISTING_ID, creator_id: CREATOR_ID, status: 'draft', deleted_at: null },
        error: null,
      });

      await expect(
        createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
          creatorId: CREATOR_ID,
          categoryId: CATEGORY_ID,
          listingId: LISTING_ID,
          title: 'Valid Title',
          description: 'Valid description that has at least 20 characters in it.',
        })
      ).rejects.toThrow('Custom orders can only be sent for approved listings');
    });
  });

  describe('Success custom order creation & status notifications', () => {
    it('creates custom order and dispatches custom_order_received notification', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      const mockOrder = {
        id: ORDER_ID,
        buyer_id: BUYER_ID,
        creator_id: CREATOR_ID,
        title: 'Valid Title',
        description: 'Valid description that has at least 20 characters in it.',
        status: 'requested',
      };
      vi.mocked(createCustomOrder).mockResolvedValueOnce(mockOrder as any);

      const res = await createCurrentUserCustomOrder(mockSupabase as SupabaseClient, {
        creatorId: CREATOR_ID,
        categoryId: CATEGORY_ID,
        title: 'Valid Title',
        description: 'Valid description that has at least 20 characters in it.',
      });

      expect(res).toEqual(mockOrder);
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: CREATOR_USER_ID,
        type: 'custom_order_received',
        title: 'New Custom Order Request',
        body: 'New custom order request: "Valid Title".',
        entityType: 'custom_order',
        entityId: ORDER_ID,
      });
    });

    it('notifies buyer when marked as reviewing', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID,
        status: 'active',
        role: 'creator',
      } as any);
      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_ID,
        user_id: CREATOR_USER_ID,
      } as any);

      const mockOrder = { id: ORDER_ID, buyer_id: BUYER_ID, creator_id: CREATOR_ID, title: 'Valid Title', status: 'requested' };
      vi.mocked(getCustomOrderForCreator).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(updateCustomOrder).mockResolvedValueOnce({ ...mockOrder, status: 'creator_reviewing' } as any);

      const res = await markCurrentCreatorCustomOrderReviewing(mockSupabase as SupabaseClient, ORDER_ID);

      expect(res.status).toBe('creator_reviewing');
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: BUYER_ID,
        type: 'custom_order_status_changed',
        title: 'Custom Order Status Updated',
        body: 'Custom order "Valid Title" status changed to "creator_reviewing".',
        entityType: 'custom_order',
        entityId: ORDER_ID,
      });
    });

    it('notifies buyer when custom order is quoted', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: CREATOR_USER_ID,
        status: 'active',
        role: 'creator',
      } as any);
      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_ID,
        user_id: CREATOR_USER_ID,
      } as any);

      const mockOrder = { id: ORDER_ID, buyer_id: BUYER_ID, creator_id: CREATOR_ID, title: 'Valid Title', status: 'creator_reviewing' };
      vi.mocked(getCustomOrderForCreator).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(updateCustomOrder).mockResolvedValueOnce({ ...mockOrder, status: 'quoted', creator_quote_amount: 250 } as any);

      const res = await quoteCurrentCreatorCustomOrder(mockSupabase as SupabaseClient, {
        customOrderId: ORDER_ID,
        creatorQuoteAmount: 250,
        creatorQuoteNote: 'I can do this in 5 days!',
      });

      expect(res.status).toBe('quoted');
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: BUYER_ID,
        type: 'custom_order_status_changed',
        title: 'Custom Order Quoted',
        body: 'Custom order "Valid Title" has been quoted at $250.',
        entityType: 'custom_order',
        entityId: ORDER_ID,
      });
    });

    it('notifies creator when quote is accepted', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      const mockOrder = { id: ORDER_ID, buyer_id: BUYER_ID, creator_id: CREATOR_ID, title: 'Valid Title', status: 'quoted', creator_quote_amount: 250 };
      vi.mocked(getCustomOrderForBuyer).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(updateCustomOrder).mockResolvedValueOnce({ ...mockOrder, status: 'accepted' } as any);

      // Mock getting creator user profile ID for notification
      mockSupabase.from.mockImplementationOnce((table: string) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { user_id: CREATOR_USER_ID }, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
      });

      const res = await acceptCurrentBuyerCustomOrderQuote(mockSupabase as SupabaseClient, ORDER_ID);

      expect(res.status).toBe('accepted');
      expect(createSystemNotification).toHaveBeenCalledWith(mockSupabase, {
        recipientProfileId: CREATOR_USER_ID,
        type: 'custom_order_status_changed',
        title: 'Custom Quote Accepted',
        body: 'Buyer accepted your quote for custom order "Valid Title".',
        entityType: 'custom_order',
        entityId: ORDER_ID,
      });
    });
  });

  describe('Payment Disabled Integration', () => {
    it('allows custom order quote acceptance cleanly but blocks payments when payments are disabled', async () => {
      // 1. Accept quote works cleanly
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      const mockOrder = { id: ORDER_ID, buyer_id: BUYER_ID, creator_id: CREATOR_ID, title: 'Valid Title', status: 'quoted', creator_quote_amount: 250 };
      vi.mocked(getCustomOrderForBuyer).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(updateCustomOrder).mockResolvedValueOnce({ ...mockOrder, status: 'accepted' } as any);

      // Mock getting creator user profile ID for notification
      mockSupabase.from.mockImplementationOnce((table: string) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { user_id: CREATOR_USER_ID }, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
      });

      const res = await acceptCurrentBuyerCustomOrderQuote(mockSupabase as SupabaseClient, ORDER_ID);
      expect(res.status).toBe('accepted');

      // 2. Online payments initiation throws disabled error
      process.env.PAYMENTS_ENABLED = 'false';

      await expect(
        createPaymentForCurrentBuyerOrder(mockSupabase as SupabaseClient, {
          orderId: ORDER_ID,
        })
      ).rejects.toThrow('Online payment is currently disabled. You can still contact the creator or request a custom order.');
    });
  });
});
