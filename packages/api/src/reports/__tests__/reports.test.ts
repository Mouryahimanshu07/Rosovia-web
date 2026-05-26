import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentUserReport,
  moderateReportAsAdmin,
  listCurrentUserReportsService,
  listReportsForAdmin,
} from '../report.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import {
  getReportById,
  createReport,
  getDuplicatePendingReport,
  validateReportTargetExists,
  getInquiryParticipants,
  resolveReportAtomic,
} from '../report.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../report.repository', () => ({
  getReportById: vi.fn(),
  createReport: vi.fn(),
  updateReport: vi.fn(),
  listCurrentUserReports: vi.fn(),
  listAdminReports: vi.fn(),
  getDuplicatePendingReport: vi.fn(),
  validateReportTargetExists: vi.fn(),
  getInquiryParticipants: vi.fn(),
  createAdminAction: vi.fn(),
  listAdminActions: vi.fn(),
  listAdminActionsByTarget: vi.fn(),
  resolveReportAtomic: vi.fn(),
}));

const REPORTER_ID = 'ad335b1b-f06b-4e1b-90f7-5d2f782c5f1c';
const TARGET_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
const INQUIRY_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';
const REPORT_ID = 'f1a9a8f2-39c4-4c48-8df0-7bc4792c3a50';

describe('Reports & Moderation Service Pipeline', () => {
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
    };
  });

  describe('createCurrentUserReport', () => {
    it('successfully creates a report for a valid listing target', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer',
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(validateReportTargetExists).mockResolvedValueOnce(true);
      vi.mocked(getDuplicatePendingReport).mockResolvedValueOnce(null);
      vi.mocked(createReport).mockResolvedValueOnce({
        id: REPORT_ID,
        reporter_id: REPORTER_ID,
        target_type: 'listing',
        target_id: TARGET_ID,
        reason: 'spam',
        description: 'spam listing details',
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      });

      const res = await createCurrentUserReport(mockSupabase as SupabaseClient, {
        targetType: 'listing',
        targetId: TARGET_ID,
        reason: 'spam',
        description: 'spam listing details',
      });

      expect(res).toBeDefined();
      expect(res.id).toBe(REPORT_ID);
      expect(validateReportTargetExists).toHaveBeenCalledWith(mockSupabase, 'listing', TARGET_ID);
      expect(createReport).toHaveBeenCalledWith(mockSupabase, {
        reporter_id: REPORTER_ID,
        target_type: 'listing',
        target_id: TARGET_ID,
        reason: 'spam',
        description: 'spam listing details',
      });
    });

    it('rejects report if the target does not exist', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer',
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(validateReportTargetExists).mockResolvedValueOnce(false);

      await expect(
        createCurrentUserReport(mockSupabase as SupabaseClient, {
          targetType: 'listing',
          targetId: TARGET_ID,
          reason: 'spam',
        })
      ).rejects.toThrow('The reported listing does not exist or has been removed.');
    });

    it('blocks users from self-reporting their own account', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer',
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(validateReportTargetExists).mockResolvedValueOnce(true);

      await expect(
        createCurrentUserReport(mockSupabase as SupabaseClient, {
          targetType: 'user',
          targetId: REPORTER_ID,
          reason: 'harassment',
        })
      ).rejects.toThrow('You cannot report your own account.');
    });

    it('prevents duplicate pending reports from the same user', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer',
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(validateReportTargetExists).mockResolvedValueOnce(true);
      vi.mocked(getDuplicatePendingReport).mockResolvedValueOnce({
        id: 'existing-report-id',
        reporter_id: REPORTER_ID,
        target_type: 'listing',
        target_id: TARGET_ID,
        reason: 'spam',
        description: null,
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      });

      await expect(
        createCurrentUserReport(mockSupabase as SupabaseClient, {
          targetType: 'listing',
          targetId: TARGET_ID,
          reason: 'spam',
        })
      ).rejects.toThrow('You already have a pending report for this listing. Please wait for it to be reviewed.');
    });

    it('enforces inquiry participant limits for inquiry reports', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer',
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(validateReportTargetExists).mockResolvedValueOnce(true);
      // Mock inquiry participants where reporter is not involved
      vi.mocked(getInquiryParticipants).mockResolvedValueOnce({
        buyer_id: 'some-other-buyer-id',
        creator_id: 'some-other-creator-id',
      });

      await expect(
        createCurrentUserReport(mockSupabase as SupabaseClient, {
          targetType: 'inquiry',
          targetId: INQUIRY_ID,
          reason: 'harassment',
        })
      ).rejects.toThrow('You can only report inquiries you are part of.');
    });
  });

  describe('moderateReportAsAdmin', () => {
    it('successfully moderates reports when authenticated user is admin', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'admin-profile-id',
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'admin',
        full_name: 'Admin User',
        username: 'admin',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(getReportById).mockResolvedValueOnce({
        id: REPORT_ID,
        reporter_id: REPORTER_ID,
        target_type: 'review',
        target_id: TARGET_ID,
        reason: 'harassment',
        description: null,
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
        reporter_display_name: 'Reporter Name',
        reviewed_by_name: null,
      });

      vi.mocked(resolveReportAtomic).mockResolvedValueOnce({
        id: REPORT_ID,
        reporter_id: REPORTER_ID,
        target_type: 'review',
        target_id: TARGET_ID,
        reason: 'harassment',
        description: null,
        status: 'resolved',
        admin_note: 'Hiding abusive review',
        reviewed_by: 'admin-profile-id',
        reviewed_at: '',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      });

      const res = await moderateReportAsAdmin(mockSupabase as SupabaseClient, {
        reportId: REPORT_ID,
        action: 'hide_review',
        adminNote: 'Hiding abusive review',
      });

      expect(res).toBeDefined();
      expect(res.status).toBe('resolved');
      expect(resolveReportAtomic).toHaveBeenCalledWith(
        mockSupabase,
        REPORT_ID,
        'resolved',
        'Hiding abusive review',
        'hide_review'
      );
    });

    it('rejects moderation actions targeting mismatching types', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'admin-profile-id',
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'admin',
        full_name: 'Admin User',
        username: 'admin',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      vi.mocked(getReportById).mockResolvedValueOnce({
        id: REPORT_ID,
        reporter_id: REPORTER_ID,
        target_type: 'listing', // Target type is listing
        target_id: TARGET_ID,
        reason: 'spam',
        description: null,
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
        reporter_display_name: 'Reporter Name',
        reviewed_by_name: null,
      });

      await expect(
        moderateReportAsAdmin(mockSupabase as SupabaseClient, {
          reportId: REPORT_ID,
          action: 'hide_review', // action only valid for reports targeting a review
          adminNote: 'Trying to hide',
        })
      ).rejects.toThrow('hide_review action is only valid for reports targeting a review.');
    });

    it('rejects if current user is not admin', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: REPORTER_ID,
        auth_user_id: 'auth-user-123',
        status: 'active',
        role: 'buyer', // Role is buyer
        full_name: 'Reporter Name',
        username: 'reporter',
        created_at: '',
        updated_at: '',
        deleted_at: null,
      } as any);

      await expect(
        moderateReportAsAdmin(mockSupabase as SupabaseClient, {
          reportId: REPORT_ID,
          action: 'mark_reviewed',
        })
      ).rejects.toThrow('Admin access required');
    });
  });
});
