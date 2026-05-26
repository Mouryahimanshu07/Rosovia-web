import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentBuyerReview,
  listReviewsForPublicCreator,
  listReviewsForPublicListing,
  listBuyerReviewsForCurrentUser,
  listCreatorReviewsForCurrentUser,
  hideReviewAsAdmin,
} from '../review.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import {
  listReviewsByCreatorId,
  listReviewsByListingId,
  listCurrentBuyerReviews,
  listCurrentCreatorReceivedReviews,
  updateReviewVisibility,
} from '../review.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../review.repository', () => ({
  listReviewsByCreatorId: vi.fn(),
  listReviewsByListingId: vi.fn(),
  listCurrentBuyerReviews: vi.fn(),
  listCurrentCreatorReceivedReviews: vi.fn(),
  updateReviewVisibility: vi.fn(),
  getReviewByOrderId: vi.fn(),
}));

const BUYER_ID = 'ad335b1b-f06b-4e1b-90f7-5d2f782c5f1c';
const CREATOR_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
const LISTING_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';
const ORDER_ID = '898ad7a0-0435-4309-847e-85e7db0101e4';
const REVIEW_ID = 'f1a9a8f2-39c4-4c48-8df0-7bc4792c3a50';
const MEDIA_ID = '4a8a9a8c-39c4-4c48-8df0-7bc4792c3a50';

describe('Reviews Service & Target Constraints', () => {
  let mockSupabase: any;
  let mockUserResponse: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserResponse = {
      data: { user: { id: 'auth-user-123' } },
      error: null,
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue(mockUserResponse),
      },
      from: vi.fn((table) => {
        if (table === 'media_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: MEDIA_ID, uploaded_by: BUYER_ID },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: REVIEW_ID,
          order_id: ORDER_ID,
          buyer_id: BUYER_ID,
          creator_id: CREATOR_ID,
          listing_id: LISTING_ID,
          rating: 5,
        },
        error: null,
      }),
    };

    // Default mock returning active buyer profile
    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: BUYER_ID,
      auth_user_id: 'auth-user-123',
      status: 'active',
      role: 'buyer',
      full_name: 'Buyer Name',
      username: 'buyer',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    } as any);
  });

  describe('createCurrentBuyerReview', () => {
    it('successfully creates a review for a completed order', async () => {
      const res = await createCurrentBuyerReview(mockSupabase as SupabaseClient, {
        orderId: ORDER_ID,
        rating: 5,
        comment: 'Excellent service!',
      });

      expect(res).toBeDefined();
      expect(res.id).toBe(REVIEW_ID);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_review_for_completed_order_atomic', {
        p_order_id: ORDER_ID,
        p_rating: 5,
        p_comment: 'Excellent service!',
        p_quality_rating: null,
        p_communication_rating: null,
        p_delivery_rating: null,
        p_media_id: null,
      });
    });

    it('rejects if current user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(
        createCurrentBuyerReview(mockSupabase as SupabaseClient, {
          orderId: ORDER_ID,
          rating: 4,
          mediaId: MEDIA_ID, // triggers auth check
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('rejects if current profile status is inactive', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        auth_user_id: 'auth-user-123',
        status: 'suspended', // inactive
        role: 'buyer',
        full_name: 'Buyer Name',
        username: 'buyer',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      await expect(
        createCurrentBuyerReview(mockSupabase as SupabaseClient, {
          orderId: ORDER_ID,
          rating: 4,
          mediaId: MEDIA_ID, // triggers profile check
        })
      ).rejects.toThrow('Your account is not active');
    });

    it('validates and rejects media asset if it does not belong to the buyer', async () => {
      // Override media query mock to return a different owner
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: MEDIA_ID, uploaded_by: 'different-buyer-uuid' },
          error: null,
        }),
      });

      await expect(
        createCurrentBuyerReview(mockSupabase as SupabaseClient, {
          orderId: ORDER_ID,
          rating: 5,
          mediaId: MEDIA_ID,
        })
      ).rejects.toThrow('Media asset does not belong to you');
    });
  });

  describe('list and visibility functions', () => {
    it('listReviewsForPublicCreator maps correctly to listReviewsByCreatorId', async () => {
      vi.mocked(listReviewsByCreatorId).mockResolvedValueOnce([]);
      const res = await listReviewsForPublicCreator(mockSupabase as SupabaseClient, CREATOR_ID);
      expect(listReviewsByCreatorId).toHaveBeenCalledWith(mockSupabase, CREATOR_ID, {});
      expect(res).toEqual([]);
    });

    it('listReviewsForPublicListing maps correctly to listReviewsByListingId', async () => {
      vi.mocked(listReviewsByListingId).mockResolvedValueOnce([]);
      const res = await listReviewsForPublicListing(mockSupabase as SupabaseClient, LISTING_ID);
      expect(listReviewsByListingId).toHaveBeenCalledWith(mockSupabase, LISTING_ID, {});
      expect(res).toEqual([]);
    });

    it('listBuyerReviewsForCurrentUser lists buyer submitted reviews', async () => {
      vi.mocked(listCurrentBuyerReviews).mockResolvedValueOnce([]);
      const res = await listBuyerReviewsForCurrentUser(mockSupabase as SupabaseClient);
      expect(listCurrentBuyerReviews).toHaveBeenCalledWith(mockSupabase, BUYER_ID, {});
      expect(res).toEqual([]);
    });

    it('listCreatorReviewsForCurrentUser lists creator reviews received', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'creator-user-id',
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'creator', // override to creator
        full_name: 'Creator Name',
        username: 'creator',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: CREATOR_ID,
        user_id: 'creator-user-id',
        display_name: 'Creator Name',
        slug: 'creator',
        bio: null,
        story: null,
        primary_category_id: null,
        skills: [],
        languages: [],
        city: null,
        state: null,
        country: 'IN',
        profile_image_url: null,
        intro_video_url: null,
        verification_level: 'basic_verified',
        is_verified: true,
        rating_avg: 0,
        rating_count: 0,
        total_orders: 0,
        total_followers: 0,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      });

      vi.mocked(listCurrentCreatorReceivedReviews).mockResolvedValueOnce([]);
      const res = await listCreatorReviewsForCurrentUser(mockSupabase as SupabaseClient);
      expect(listCurrentCreatorReceivedReviews).toHaveBeenCalledWith(mockSupabase, CREATOR_ID, {});
      expect(res).toEqual([]);
    });

    it('hideReviewAsAdmin updates review visibility if user is admin', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'admin-user-id',
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'admin', // override to admin
        full_name: 'Admin User',
        username: 'admin',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(updateReviewVisibility).mockResolvedValueOnce({
        id: REVIEW_ID,
        order_id: ORDER_ID,
        buyer_id: BUYER_ID,
        creator_id: CREATOR_ID,
        listing_id: LISTING_ID,
        rating: 5,
        quality_rating: null,
        communication_rating: null,
        delivery_rating: null,
        comment: '',
        media_id: null,
        is_hidden: true,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      });

      const res = await hideReviewAsAdmin(mockSupabase as SupabaseClient, {
        reviewId: REVIEW_ID,
        isHidden: true,
      });

      expect(updateReviewVisibility).toHaveBeenCalledWith(mockSupabase, REVIEW_ID, true);
      expect(res.is_hidden).toBe(true);
    });

    it('hideReviewAsAdmin rejects if user is not admin', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: BUYER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer', // default buyer, should reject
        full_name: 'Buyer Name',
        username: 'buyer',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      await expect(
        hideReviewAsAdmin(mockSupabase as SupabaseClient, {
          reviewId: REVIEW_ID,
          isHidden: true,
        })
      ).rejects.toThrow('Admin access required');
    });
  });
});
