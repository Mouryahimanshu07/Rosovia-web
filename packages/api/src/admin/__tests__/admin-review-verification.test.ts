import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  moderateReviewAsAdmin,
  moderateVerificationRequestAsAdmin,
} from '../admin.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import {
  setReviewHiddenAtomic,
  getAdminDashboardStats,
  listAdminUsers,
  getProfileById,
  setUserStatusAtomic,
  listAdminCreators,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  listAdminListings,
  setListingStatusAtomic,
  listAdminReviews,
  listAdminOrders,
  listAdminPayments,
  listAdminActionLogs,
  getMarketplaceKpiSummary,
  listAdminPosts,
  setPostStatusAtomic,
} from '../admin.repository';
import { createAdminAction } from '../../reports/report.repository';
import { reviewVerificationRequestAsAdmin } from '../../verification/verification.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../admin.repository', () => ({
  getAdminDashboardStats: vi.fn(),
  listAdminUsers: vi.fn(),
  getProfileById: vi.fn(),
  setUserStatusAtomic: vi.fn(),
  listAdminCreators: vi.fn(),
  listAdminCategories: vi.fn(),
  createAdminCategory: vi.fn(),
  updateAdminCategory: vi.fn(),
  listAdminListings: vi.fn(),
  setListingStatusAtomic: vi.fn(),
  listAdminReviews: vi.fn(),
  setReviewHiddenAtomic: vi.fn(),
  listAdminOrders: vi.fn(),
  listAdminPayments: vi.fn(),
  listAdminActionLogs: vi.fn(),
  getMarketplaceKpiSummary: vi.fn(),
  listAdminPosts: vi.fn(),
  setPostStatusAtomic: vi.fn(),
}));

vi.mock('../../reports/report.repository', () => ({
  createAdminAction: vi.fn(),
}));

vi.mock('../../verification/verification.service', () => ({
  reviewVerificationRequestAsAdmin: vi.fn(),
  // Re-export other things verification.service exports so admin.service import doesn't break
  getVerificationRequestById: vi.fn(),
  listCurrentUserVerificationRequests: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@rosovia/integrations', () => ({
  getDatabaseClients: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ID = 'admin-profile-001';
const REVIEW_ID = 'review-uuid-001';
const VERIFICATION_REQUEST_ID = 'verif-req-001';
const CREATOR_USER_ID = 'creator-user-001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Review Moderation — audit trail', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-admin' } },
          error: null,
        }),
      },
    };

    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: ADMIN_ID,
      role: 'admin',
      status: 'active',
    } as any);

    vi.mocked(setReviewHiddenAtomic).mockResolvedValue(undefined as any);
    vi.mocked(createAdminAction).mockResolvedValue({} as any);
  });

  it('hides a review and logs review_hidden to admin_actions', async () => {
    await moderateReviewAsAdmin(mockSupabase as SupabaseClient, {
      reviewId: REVIEW_ID,
      action: 'hide',
      note: 'Fake review detected',
    });

    expect(setReviewHiddenAtomic).toHaveBeenCalledWith(
      mockSupabase,
      REVIEW_ID,
      true,
      'Fake review detected'
    );

    expect(createAdminAction).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        admin_id: ADMIN_ID,
        action_type: 'review_hidden',
        target_type: 'review',
        target_id: REVIEW_ID,
        note: 'Fake review detected',
        metadata: { is_hidden: true },
      })
    );
  });

  it('unhides a review and logs review_unhidden to admin_actions', async () => {
    await moderateReviewAsAdmin(mockSupabase as SupabaseClient, {
      reviewId: REVIEW_ID,
      action: 'unhide',
      note: 'Reviewed — legitimate review',
    });

    expect(setReviewHiddenAtomic).toHaveBeenCalledWith(
      mockSupabase,
      REVIEW_ID,
      false,
      'Reviewed — legitimate review'
    );

    expect(createAdminAction).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        admin_id: ADMIN_ID,
        action_type: 'review_unhidden',
        target_type: 'review',
        target_id: REVIEW_ID,
        note: 'Reviewed — legitimate review',
        metadata: { is_hidden: false },
      })
    );
  });

  it('throws Admin access required for non-admin callers', async () => {
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: 'buyer-123',
      role: 'buyer',
      status: 'active',
    } as any);

    await expect(
      moderateReviewAsAdmin(mockSupabase as SupabaseClient, {
        reviewId: REVIEW_ID,
        action: 'hide',
      })
    ).rejects.toThrow('Admin access required');

    expect(setReviewHiddenAtomic).not.toHaveBeenCalled();
    expect(createAdminAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('Admin Verification Moderation — moderateVerificationRequestAsAdmin', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-admin' } },
          error: null,
        }),
      },
    };

    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: ADMIN_ID,
      role: 'admin',
      status: 'active',
    } as any);

    vi.mocked(reviewVerificationRequestAsAdmin).mockResolvedValue({
      id: VERIFICATION_REQUEST_ID,
      status: 'approved',
    } as any);
  });

  it('approves a verification request by delegating to verification.service', async () => {
    const result = await moderateVerificationRequestAsAdmin(
      mockSupabase as SupabaseClient,
      { requestId: VERIFICATION_REQUEST_ID, action: 'approve', note: 'Documents verified' }
    );

    expect(reviewVerificationRequestAsAdmin).toHaveBeenCalledWith(
      mockSupabase,
      {
        verificationRequestId: VERIFICATION_REQUEST_ID,
        decision: 'approve',
        adminNote: 'Documents verified',
      }
    );

    expect(result.status).toBe('approved');
  });

  it('rejects a verification request by delegating to verification.service', async () => {
    vi.mocked(reviewVerificationRequestAsAdmin).mockResolvedValueOnce({
      id: VERIFICATION_REQUEST_ID,
      status: 'rejected',
    } as any);

    const result = await moderateVerificationRequestAsAdmin(
      mockSupabase as SupabaseClient,
      { requestId: VERIFICATION_REQUEST_ID, action: 'reject', note: 'Docs unclear' }
    );

    expect(reviewVerificationRequestAsAdmin).toHaveBeenCalledWith(
      mockSupabase,
      {
        verificationRequestId: VERIFICATION_REQUEST_ID,
        decision: 'reject',
        adminNote: 'Docs unclear',
      }
    );

    expect(result.status).toBe('rejected');
  });

  it('throws Admin access required for non-admin callers', async () => {
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: 'creator-123',
      role: 'creator',
      status: 'active',
    } as any);

    await expect(
      moderateVerificationRequestAsAdmin(mockSupabase as SupabaseClient, {
        requestId: VERIFICATION_REQUEST_ID,
        action: 'approve',
      })
    ).rejects.toThrow('Admin access required');

    // Verification service must NOT be called — admin gate must fire first
    expect(reviewVerificationRequestAsAdmin).not.toHaveBeenCalled();
  });

  it('throws if admin account is suspended', async () => {
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: ADMIN_ID,
      role: 'admin',
      status: 'suspended',
    } as any);

    await expect(
      moderateVerificationRequestAsAdmin(mockSupabase as SupabaseClient, {
        requestId: VERIFICATION_REQUEST_ID,
        action: 'approve',
      })
    ).rejects.toThrow('Your account is not active');

    expect(reviewVerificationRequestAsAdmin).not.toHaveBeenCalled();
  });
});
