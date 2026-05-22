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
  // Calculate badge counts dynamically based on orders needing attention to avoid DB notifications read overhead.
  const { data: creatorProfile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', profileId)
    .is('deleted_at', null)
    .maybeSingle();

  let actionRequiredCount = 0;

  if (creatorProfile) {
    const { count: creatorCount, error: creatorErr } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorProfile.id)
      .in('order_status', ['paid', 'in_progress'])
      .is('deleted_at', null);

    if (!creatorErr && creatorCount !== null) {
      actionRequiredCount += creatorCount;
    }
  }

  const { count: buyerCount, error: buyerErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', profileId)
    .in('order_status', ['shipped', 'delivered'])
    .is('deleted_at', null);

  if (!buyerErr && buyerCount !== null) {
    actionRequiredCount += buyerCount;
  }

  return actionRequiredCount;
}

export async function createNotification(
  supabase: SupabaseClient,
  input: NotificationCreateInput
): Promise<Notification> {
  // Skip database insert to prevent database-backed notification row accumulation.
  // Instead, simulate a transactional email dispatch.
  console.log(`[Notification Sim] Transactional notification sent to profile ${input.recipientProfileId}: "${input.title}" - ${input.body}`);

  return {
    id: '00000000-0000-0000-0000-000000000000',
    recipient_profile_id: input.recipientProfileId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
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
