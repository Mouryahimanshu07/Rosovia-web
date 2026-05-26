'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  markNotificationAsReadForCurrentUser,
  markAllNotificationsAsReadForCurrentUser,
} from '@rosovia/api';
import { captureAppError } from '~/lib/analytics/capture-error';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<ActionResult> {
  if (!notificationId || typeof notificationId !== 'string') {
    return { success: false, error: 'Invalid notification ID' };
  }

  try {
    const supabase = createWebServerClient();
    await markNotificationAsReadForCurrentUser(supabase, notificationId);

    // Revalidate notifications dashboard & header unread badge count
    revalidatePath('/dashboard/notifications');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'notifications', action: 'mark_as_read' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark notification as read',
    };
  }
}

/**
 * Marks all notifications for the current authenticated user as read.
 */
export async function markAllNotificationsAsReadAction(): Promise<ActionResult> {
  try {
    const supabase = createWebServerClient();
    await markAllNotificationsAsReadForCurrentUser(supabase);

    revalidatePath('/dashboard/notifications');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (err) {
    captureAppError(err, { module: 'notifications', action: 'mark_all_as_read' });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark all notifications as read',
    };
  }
}
