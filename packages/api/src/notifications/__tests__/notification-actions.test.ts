import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listCurrentUserNotifications,
  getUnreadCountForCurrentUser,
  markNotificationAsReadForCurrentUser,
  markAllNotificationsAsReadForCurrentUser,
  createSystemNotification,
} from '../notification.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import {
  getNotificationById,
  listNotificationsForProfile,
  getUnreadCountForProfile,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../notification.repository';

vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../notification.repository', () => ({
  getNotificationById: vi.fn(),
  listNotificationsForProfile: vi.fn(),
  getUnreadCountForProfile: vi.fn(),
  createNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

// Valid UUIDs
const USER_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';
const OTHER_USER_ID = 'ad335b1b-f06b-4e1b-90f7-5d2f782c5f1c';
const NOTIFICATION_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';

describe('Notifications Service Actions & Security', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: USER_ID, status: 'active', deleted_at: null },
          error: null,
        }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth_user_id' } },
          error: null,
        }),
      },
    };
  });

  describe('listCurrentUserNotifications', () => {
    it('fetches notifications for the active user', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      const mockList = [
        { id: '1', recipient_profile_id: USER_ID, title: 'Notif 1', type: 'message_received' },
      ];
      vi.mocked(listNotificationsForProfile).mockResolvedValueOnce(mockList as any);

      const res = await listCurrentUserNotifications(mockSupabase as SupabaseClient);

      expect(res).toEqual(mockList);
      expect(listNotificationsForProfile).toHaveBeenCalledWith(mockSupabase, USER_ID, undefined);
    });
  });

  describe('getUnreadCountForCurrentUser', () => {
    it('returns the count of unread notifications', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getUnreadCountForProfile).mockResolvedValueOnce(5);

      const res = await getUnreadCountForCurrentUser(mockSupabase as SupabaseClient);

      expect(res).toBe(5);
      expect(getUnreadCountForProfile).toHaveBeenCalledWith(mockSupabase, USER_ID);
    });
  });

  describe('markNotificationAsReadForCurrentUser', () => {
    it('marks notification as read if user is the recipient', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getNotificationById).mockResolvedValueOnce({
        id: NOTIFICATION_ID,
        recipient_profile_id: USER_ID,
        title: 'Title',
      } as any);

      const mockUpdated = {
        id: NOTIFICATION_ID,
        recipient_profile_id: USER_ID,
        read_at: new Date().toISOString(),
      };
      vi.mocked(markNotificationAsRead).mockResolvedValueOnce(mockUpdated as any);

      const res = await markNotificationAsReadForCurrentUser(
        mockSupabase as SupabaseClient,
        NOTIFICATION_ID
      );

      expect(res).toEqual(mockUpdated);
      expect(markNotificationAsRead).toHaveBeenCalledWith(mockSupabase, NOTIFICATION_ID, USER_ID);
    });

    it('throws error if notification does not belong to the user', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      // Notification belongs to OTHER_USER_ID
      vi.mocked(getNotificationById).mockResolvedValueOnce({
        id: NOTIFICATION_ID,
        recipient_profile_id: OTHER_USER_ID,
        title: 'Title',
      } as any);

      await expect(
        markNotificationAsReadForCurrentUser(mockSupabase as SupabaseClient, NOTIFICATION_ID)
      ).rejects.toThrow('You are not authorized to access this notification');

      expect(markNotificationAsRead).not.toHaveBeenCalled();
    });

    it('throws error if notification is not found', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      vi.mocked(getNotificationById).mockResolvedValueOnce(null);

      await expect(
        markNotificationAsReadForCurrentUser(mockSupabase as SupabaseClient, NOTIFICATION_ID)
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('markAllNotificationsAsReadForCurrentUser', () => {
    it('marks all as read', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: USER_ID,
        status: 'active',
        role: 'buyer',
      } as any);

      await markAllNotificationsAsReadForCurrentUser(mockSupabase as SupabaseClient);

      expect(markAllNotificationsAsRead).toHaveBeenCalledWith(mockSupabase, USER_ID);
    });
  });

  describe('createSystemNotification', () => {
    it('inserts a notification if recipient exists', async () => {
      const mockNotif = {
        recipientProfileId: USER_ID,
        type: 'message_received' as const,
        title: 'System message',
      };

      const mockResult = {
        id: 'new-notif-uuid',
        ...mockNotif,
      };

      vi.mocked(createNotification).mockResolvedValueOnce(mockResult as any);

      const res = await createSystemNotification(mockSupabase as SupabaseClient, mockNotif);

      expect(res).toEqual(mockResult);
      expect(createNotification).toHaveBeenCalledWith(mockSupabase, mockNotif);
    });
  });
});
