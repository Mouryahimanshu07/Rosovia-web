import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Dispute,
  DisputeListParams,
  CreateDisputeInput,
  Profile,
} from '@rosovia/core';
import {
  getDisputeById,
  getDisputeByOrderId,
  listDisputesByOpenedBy,
  listAllDisputesForAdmin,
  listDisputesByCreatorProfileId,
  updateDisputeStatus,
} from './dispute.repository';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createAdminAction } from '../reports/report.repository';
import { updateOrder } from '../orders/order.repository';

export { getDisputeById, getDisputeByOrderId };

// ---------------------------------------------------------------------------
// Internal: resolve active admin profile
// ---------------------------------------------------------------------------

async function resolveAdmin(supabase: SupabaseClient): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');
  if (profile.role !== 'admin') throw new Error('Admin access required');

  return profile;
}

// ---------------------------------------------------------------------------
// Buyer or Creator: open a dispute for an order
//
// All critical business rules are enforced atomically in the database by
// public.create_dispute_atomic (migration 021):
//   - Caller must be the buyer or assigned creator of the order.
//   - Order must not be cancelled, refunded, or draft.
//   - No active dispute ('open' or 'under_review') already exists.
//   - If order is not yet 'disputed', transitions it and inserts status history.
//
// Narrow cast on supabase.rpc is required because migration 021 RPCs are not
// yet reflected in database.types.ts. Remove once types are regenerated.
// ---------------------------------------------------------------------------

export async function createDisputeForOrder(
  supabase: SupabaseClient,
  input: CreateDisputeInput
): Promise<Dispute> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    'create_dispute_atomic',
    {
      p_order_id:    input.orderId,
      p_reason:      input.reason,
      p_description: input.description ?? null,
    }
  ) as { data: Dispute | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Dispute creation failed');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Current user: list own opened disputes
// ---------------------------------------------------------------------------

export async function listDisputesOpenedByCurrentUser(
  supabase: SupabaseClient,
  profileId: string,
  params: DisputeListParams = {}
): Promise<Dispute[]> {
  return listDisputesByOpenedBy(supabase, profileId, params);
}

// ---------------------------------------------------------------------------
// Creator: list disputes for own assigned orders
// ---------------------------------------------------------------------------

export async function listCreatorDisputes(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: DisputeListParams = {}
): Promise<Dispute[]> {
  return listDisputesByCreatorProfileId(supabase, creatorProfileId, params);
}

// ---------------------------------------------------------------------------
// Admin: list all disputes
// ---------------------------------------------------------------------------

export async function listAdminDisputes(
  supabase: SupabaseClient,
  params: DisputeListParams = {}
): Promise<Dispute[]> {
  await resolveAdmin(supabase);
  return listAllDisputesForAdmin(supabase, params);
}

// ---------------------------------------------------------------------------
// Admin: moderate dispute
// ---------------------------------------------------------------------------

export async function moderateDispute(
  supabase: SupabaseClient,
  disputeId: string,
  action: 'under_review' | 'resolve' | 'reject',
  note?: string
): Promise<Dispute> {
  const admin = await resolveAdmin(supabase);

  const dispute = await getDisputeById(supabase, disputeId);
  if (!dispute) {
    throw new Error('Dispute not found');
  }

  // Prevent creator/buyer from resolving their own dispute if they happen to be an admin
  if (dispute.opened_by === admin.id && action === 'resolve') {
    throw new Error('You cannot resolve a dispute you opened.');
  }

  const actionMap: Record<string, string> = {
    under_review: 'under_review',
    resolve: 'resolved',
    reject: 'rejected',
  };

  const status = actionMap[action];
  if (!status) throw new Error(`Invalid dispute moderation action: ${action}`);

  const now = new Date().toISOString();

  const updateData: {
    status: string;
    resolution_note: string | null;
    resolved_by: string;
    resolved_at: string;
  } = {
    status,
    resolution_note: note ?? null,
    resolved_by: admin.id,
    resolved_at: now,
  };

  const updated = await updateDisputeStatus(supabase, disputeId, updateData);

  // Transition the associated order out of 'disputed' status.
  // resolve  → 'completed'  (admin ruled in favour of delivery / closes order)
  // reject   → 'cancelled'  (admin ruled dispute invalid / cancels order)
  // under_review → no order status change (still active)
  if (action === 'resolve' || action === 'reject') {
    const orderStatus = action === 'resolve' ? 'completed' : 'cancelled';
    try {
      await updateOrder(supabase, dispute.order_id, { order_status: orderStatus });
    } catch (orderErr) {
      // Non-fatal: log but don't roll back the dispute update
      console.error(
        `Failed to transition order ${dispute.order_id} to ${orderStatus} after dispute resolution:`,
        orderErr instanceof Error ? orderErr.message : orderErr
      );
    }
  }

  // Log to admin action log
  const actionTypeMap: Record<'under_review' | 'resolve' | 'reject', 'dispute_under_review' | 'dispute_resolved' | 'dispute_rejected'> = {
    under_review: 'dispute_under_review',
    resolve: 'dispute_resolved',
    reject: 'dispute_rejected',
  };

  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: actionTypeMap[action],
    target_type: 'dispute',
    target_id: disputeId,
    note: note ?? null,
  });

  return updated;
}

