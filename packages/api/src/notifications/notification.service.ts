import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notification, NotificationCreateInput } from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import {
  getNotificationById,
  listNotificationsForProfile,
  getUnreadCountForProfile,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './notification.repository';

// ---------------------------------------------------------------------------
// Internal Helper: resolve active authenticated profile
// ---------------------------------------------------------------------------
async function resolveActiveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// Notification Services
// ---------------------------------------------------------------------------

/**
 * Lists all notifications for the currently logged-in authenticated user.
 */
export async function listCurrentUserNotifications(
  supabase: SupabaseClient,
  options?: { limit?: number; onlyUnread?: boolean }
): Promise<Notification[]> {
  const profile = await resolveActiveProfile(supabase);
  return listNotificationsForProfile(supabase, profile.id, options);
}

/**
 * Retrieves the unread count of notifications for the current authenticated user.
 */
export async function getUnreadCountForCurrentUser(
  supabase: SupabaseClient
): Promise<number> {
  const profile = await resolveActiveProfile(supabase);
  return getUnreadCountForProfile(supabase, profile.id);
}

/**
 * Marks a specific notification as read, validating ownership.
 */
export async function markNotificationAsReadForCurrentUser(
  supabase: SupabaseClient,
  notificationId: string
): Promise<Notification> {
  const profile = await resolveActiveProfile(supabase);

  // 1. Fetch notification to verify ownership/existence
  const notification = await getNotificationById(supabase, notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.recipient_profile_id !== profile.id) {
    throw new Error('You are not authorized to access this notification');
  }

  // 2. Perform the update
  return markNotificationAsRead(supabase, notificationId, profile.id);
}

/**
 * Marks all unread notifications as read for the current user.
 */
export async function markAllNotificationsAsReadForCurrentUser(
  supabase: SupabaseClient
): Promise<void> {
  const profile = await resolveActiveProfile(supabase);
  await markAllNotificationsAsRead(supabase, profile.id);
}

/**
 * Helper to allow system services or admin tasks to insert notifications.
 * Since this is meant to be called by internal services (which can bypass RLS via service role client),
 * we validate that the recipient profile exists, but we do not enforce that the caller is the recipient.
 */
export async function createSystemNotification(
  supabase: SupabaseClient,
  input: NotificationCreateInput
): Promise<Notification> {
  // Simple validation to ensure the profile exists
  const { data: recipientProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', input.recipientProfileId)
    .is('deleted_at', null)
    .single();

  if (profileError || !recipientProfile) {
    throw new Error('Recipient profile not found or is inactive');
  }

  return createNotification(supabase, input);
}
