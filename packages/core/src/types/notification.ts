// Notification types for Rosovia Module: Notifications
// Valid notification types and entity type mappings

export type NotificationType =
  | 'order_created'
  | 'order_status_changed'
  | 'payment_received'
  | 'refund_requested'
  | 'dispute_opened'
  | 'message_received'
  | 'review_received'
  | 'verification_updated'
  | 'admin_action';

export type NotificationEntityType =
  | 'order'
  | 'payment'
  | 'refund'
  | 'dispute'
  | 'conversation'
  | 'review'
  | 'verification_request'
  | 'listing'
  | 'creator'
  | 'user';

export interface Notification {
  id: string;
  recipient_profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface NotificationCreateInput {
  recipientProfileId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
}
