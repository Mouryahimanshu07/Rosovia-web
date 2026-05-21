import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Dispute,
  DisputeListParams,
  CreateDisputeInput,
} from '@rosovia/core';
import {
  getDisputeById,
  getDisputeByOrderId,
  listDisputesByOpenedBy,
} from './dispute.repository';

export { getDisputeById, getDisputeByOrderId };

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
