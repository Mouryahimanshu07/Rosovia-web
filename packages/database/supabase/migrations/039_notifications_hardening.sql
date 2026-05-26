-- =============================================================================
-- Rosovia Module: Notifications Hardening
-- Migration: 039_notifications_hardening.sql
-- Depends on: 026_notifications.sql
-- Purpose: Expands check constraints on public.notifications to support inquiry and custom order notifications.
-- =============================================================================

-- Drop existing type check constraint
alter table public.notifications
  drop constraint if exists notifications_type_check;

-- Re-add type check constraint with the expanded list of values
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'order_created',
      'order_status_changed',
      'payment_received',
      'refund_requested',
      'dispute_opened',
      'message_received',
      'review_received',
      'verification_updated',
      'admin_action',
      'inquiry_received',
      'inquiry_replied',
      'custom_order_received',
      'custom_order_status_changed'
    )
  );

-- Drop existing entity_type check constraint
alter table public.notifications
  drop constraint if exists notifications_entity_type_check;

-- Re-add entity_type check constraint with the expanded list of values
alter table public.notifications
  add constraint notifications_entity_type_check check (
    entity_type is null or entity_type in (
      'order',
      'payment',
      'refund',
      'dispute',
      'conversation',
      'review',
      'verification_request',
      'listing',
      'creator',
      'user',
      'inquiry',
      'custom_order'
    )
  );
