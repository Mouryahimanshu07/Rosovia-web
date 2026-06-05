import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { moderateListingAsAdmin } from '../admin.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { setListingStatusAtomic } from '../admin.repository';
import { getListingById } from '../../listings/listing.repository';
import { createSystemNotification } from '../../notifications/notification.service';
import { getDatabaseClients } from '@rosovia/integrations';

// Mock repositories & integrations
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../admin.repository', () => ({
  setListingStatusAtomic: vi.fn(),
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
}));

vi.mock('../../listings/listing.repository', () => ({
  getListingById: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn(),
}));

vi.mock('@rosovia/integrations', () => ({
  getDatabaseClients: vi.fn(),
}));

describe('Admin Listing Moderation Service Layer Tests', () => {
  let mockSupabase: any;
  let mockServiceRoleClient: any;
  const ADMIN_PROFILE_ID = 'admin-123';
  const LISTING_ID = 'listing-456';
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
        moderateListingAsAdmin(mockSupabase as SupabaseClient, {
          listingId: LISTING_ID,
          action: 'approve',
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
        moderateListingAsAdmin(mockSupabase as SupabaseClient, {
          listingId: LISTING_ID,
          action: 'approve',
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
        moderateListingAsAdmin(mockSupabase as SupabaseClient, {
          listingId: LISTING_ID,
          action: 'approve',
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

      vi.mocked(getListingById).mockResolvedValue({
        id: LISTING_ID,
        title: 'Premium Artwork',
        creator_id: 'creator-profile-123',
      } as any);
    });

    it('successfully approves listing and sends notification', async () => {
      await moderateListingAsAdmin(mockSupabase as SupabaseClient, {
        listingId: LISTING_ID,
        action: 'approve',
        note: 'Approved listing',
      });

      expect(setListingStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        LISTING_ID,
        'approved',
        'Approved listing',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'admin_action',
          title: 'Listing Approved',
          body: 'Your listing "Premium Artwork" has been approved.',
          entityType: 'listing',
          entityId: LISTING_ID,
        })
      );
    });

    it('successfully rejects listing and sends notification with note', async () => {
      await moderateListingAsAdmin(mockSupabase as SupabaseClient, {
        listingId: LISTING_ID,
        action: 'reject',
        note: 'Invalid description',
      });

      expect(setListingStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        LISTING_ID,
        'rejected',
        'Invalid description',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'admin_action',
          title: 'Listing Rejected',
          body: 'Your listing "Premium Artwork" has been rejected. Note: Invalid description',
          entityType: 'listing',
          entityId: LISTING_ID,
        })
      );
    });

    it('successfully suspends listing and sends notification', async () => {
      await moderateListingAsAdmin(mockSupabase as SupabaseClient, {
        listingId: LISTING_ID,
        action: 'suspend',
        note: 'Spam alert',
      });

      expect(setListingStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        LISTING_ID,
        'suspended',
        'Spam alert',
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'admin_action',
          title: 'Listing Suspended',
          body: 'Your listing "Premium Artwork" has been suspended. Reason: Spam alert',
          entityType: 'listing',
          entityId: LISTING_ID,
        })
      );
    });

    it('successfully archives listing and sends notification', async () => {
      await moderateListingAsAdmin(mockSupabase as SupabaseClient, {
        listingId: LISTING_ID,
        action: 'archive',
      });

      expect(setListingStatusAtomic).toHaveBeenCalledWith(
        mockServiceRoleClient,
        LISTING_ID,
        'archived',
        null,
        ADMIN_PROFILE_ID
      );

      expect(createSystemNotification).toHaveBeenCalledWith(
        mockServiceRoleClient,
        expect.objectContaining({
          recipientProfileId: CREATOR_USER_ID,
          type: 'admin_action',
          title: 'Listing Archived',
          body: 'Your listing "Premium Artwork" has been archived.',
          entityType: 'listing',
          entityId: LISTING_ID,
        })
      );
    });
  });
});
