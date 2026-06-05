import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { moderatePostAsAdmin } from '../admin.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { setPostStatusAtomic } from '../admin.repository';
import { getPostById } from '../../posts/post.repository';
import { createSystemNotification } from '../../notifications/notification.service';
import { getDatabaseClients } from '@rosovia/integrations';

// Mock repositories & integrations
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../admin.repository', () => ({
  setPostStatusAtomic: vi.fn(),
  getAdminDashboardStats: vi.fn(),
  listAdminUsers: vi.fn(),
  getProfileById: vi.fn(),
  setUserStatusAtomic: vi.fn(),
  listAdminCreators: vi.fn(),
  listAdminCategories: vi.fn(),
  createAdminCategory: vi.fn(),
  updateAdminCategory: vi.fn(),
  listAdminListings: vi.fn(),
  listAdminReviews: vi.fn(),
  setReviewHiddenAtomic: vi.fn(),
  listAdminOrders: vi.fn(),
  listAdminPayments: vi.fn(),
  listAdminActionLogs: vi.fn(),
  getMarketplaceKpiSummary: vi.fn(),
  listAdminPosts: vi.fn(),
}));

vi.mock('../../posts/post.repository', () => ({
  getPostById: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn(),
}));

vi.mock('@rosovia/integrations', () => ({
  getDatabaseClients: vi.fn(),
}));

describe('Admin Post Moderation Service Layer Tests', () => {
  let mockSupabase: any;
  let mockServiceRoleClient: any;
  const ADMIN_PROFILE_ID = 'admin-123';
  const POST_ID = 'post-456';
  const CREATOR_USER_ID = 'creator-user-789';

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-admin-123' } },
          error: null,
        }),
      },
    };

    mockServiceRoleClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: CREATOR_USER_ID },
        error: null,
      }),
    };

    vi.mocked(getDatabaseClients).mockReturnValue({
      master: mockServiceRoleClient,
      replica: mockServiceRoleClient,
    });
  });

  describe('Authorization checks', () => {
    it('throws error if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(
        moderatePostAsAdmin(mockSupabase as SupabaseClient, {
          postId: POST_ID,
          moderationStatus: 'approved',
          note: 'Looks good',
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('throws error if user has buyer/creator role instead of admin', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'user-123',
        role: 'creator',
        status: 'active',
      } as any);

      await expect(
        moderatePostAsAdmin(mockSupabase as SupabaseClient, {
          postId: POST_ID,
          moderationStatus: 'approved',
          note: 'Looks good',
        })
      ).rejects.toThrow('Admin access required');
    });

    it('throws error if admin is suspended', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'admin-123',
        role: 'admin',
        status: 'suspended',
      } as any);

      await expect(
        moderatePostAsAdmin(mockSupabase as SupabaseClient, {
          postId: POST_ID,
          moderationStatus: 'approved',
          note: 'Looks good',
        })
      ).rejects.toThrow('Your account is not active');
    });
  });

  describe('Success paths & notifications', () => {
    beforeEach(() => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValue({
        id: ADMIN_PROFILE_ID,
        role: 'admin',
        status: 'active',
      } as any);

      vi.mocked(getPostById).mockResolvedValue({
        id: POST_ID,
        creator_profile_id: 'creator-profile-123',
      } as any);
    });

    it('successfully approves post and sends notification', async () => {
      await moderatePostAsAdmin(mockSupabase as SupabaseClient, {
        postId: POST_ID,
        moderationStatus: 'approved',
        note: 'Approved post',
      });

      expect(setPostStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        POST_ID,
        'approved',
        'Approved post',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'post_approved',
          title: 'Post Approved',
          body: 'Your work post has been approved and is now visible on the platform.',
          entityType: 'post',
          entityId: POST_ID,
        })
      );
    });

    it('successfully rejects post and sends notification with note', async () => {
      await moderatePostAsAdmin(mockSupabase as SupabaseClient, {
        postId: POST_ID,
        moderationStatus: 'rejected',
        note: 'Low quality image',
      });

      expect(setPostStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        POST_ID,
        'rejected',
        'Low quality image',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'post_rejected',
          title: 'Post Rejected',
          body: 'Your work post has been rejected. Note: Low quality image',
          entityType: 'post',
          entityId: POST_ID,
        })
      );
    });

    it('successfully hides post and sends notification', async () => {
      await moderatePostAsAdmin(mockSupabase as SupabaseClient, {
        postId: POST_ID,
        moderationStatus: 'hidden',
        note: 'Inappropriate content',
      });

      expect(setPostStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        POST_ID,
        'hidden',
        'Inappropriate content',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'post_rejected',
          title: 'Post Hidden',
          body: 'Your work post has been hidden by administrators. Reason: Inappropriate content',
          entityType: 'post',
          entityId: POST_ID,
        })
      );
    });
  });
});
