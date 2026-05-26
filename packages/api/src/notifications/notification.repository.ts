import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notification, NotificationCreateInput } from '@rosovia/core';

// ---------------------------------------------------------------------------
// Notification Repository Functions
// ---------------------------------------------------------------------------

export async function getNotificationById(
  supabase: SupabaseClient,
  id: string
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch notification: ${error.message}`);
  }
  return data as Notification;
}

export async function listNotificationsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  options?: { limit?: number; onlyUnread?: boolean }
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .is('deleted_at', null);

  if (options?.onlyUnread) {
    query = query.is('read_at', null);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }
  return (data ?? []) as Notification[];
}

export async function getUnreadCountForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }
  return count ?? 0;
}

export async function createNotification(
  supabase: SupabaseClient,
  input: NotificationCreateInput
): Promise<Notification> {
  const { data: created, error } = await supabase
    .from('notifications')
    .insert({
      recipient_profile_id: input.recipientProfileId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  console.log(`[Notification Live] Real database notification created for profile ${input.recipientProfileId}: "${input.title}"`);
  return created as Notification;
}

export async function markNotificationAsRead(
  supabase: SupabaseClient,
  id: string,
  profileId: string
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_profile_id', profileId)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
  return data as Notification;
}

export async function markAllNotificationsAsRead(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}
