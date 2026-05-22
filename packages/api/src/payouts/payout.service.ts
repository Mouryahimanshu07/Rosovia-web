import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorPayout, PayoutListParams, Profile } from '@rosovia/core';
import {
  getPayoutById,
  listPayoutsByCreatorId,
  listAllPayoutsForAdmin,
  updatePayoutStatus,
} from './payout.repository';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createAdminAction } from '../reports/report.repository';

export { getPayoutById };

// ---------------------------------------------------------------------------
// Internal: resolve active profile (any role)
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// Internal: resolve active admin profile
// ---------------------------------------------------------------------------

async function resolveAdmin(supabase: SupabaseClient): Promise<Profile> {
  const profile = await resolveActiveProfile(supabase);
  if (profile.role !== 'admin') throw new Error('Admin access required');
  return profile;
}

// ---------------------------------------------------------------------------
// Creator: list own payouts
// ---------------------------------------------------------------------------

export async function listCreatorPayouts(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: PayoutListParams = {}
): Promise<CreatorPayout[]> {
  // Verify the calling user owns the creator profile they are requesting.
  // RLS is the primary enforcement point, but this provides defence-in-depth
  // and produces a clear error message if called incorrectly.
  const callerProfile = await resolveActiveProfile(supabase);

  const { data: creatorProfile, error } = await supabase
    .from('creator_profiles')
    .select('id, user_id')
    .eq('id', creatorProfileId)
    .is('deleted_at', null)
    .single();

  if (error || !creatorProfile) {
    throw new Error('Creator profile not found');
  }

  if ((creatorProfile as { id: string; user_id: string }).user_id !== callerProfile.id) {
    throw new Error('You do not have permission to view these payouts');
  }

  return listPayoutsByCreatorId(supabase, creatorProfileId, params);
}

// ---------------------------------------------------------------------------
// Admin: list all payouts
// ---------------------------------------------------------------------------

export async function listAdminPayouts(
  supabase: SupabaseClient,
  params: PayoutListParams = {}
): Promise<CreatorPayout[]> {
  await resolveAdmin(supabase);
  return listAllPayoutsForAdmin(supabase, params);
}

// ---------------------------------------------------------------------------
// Admin: moderate/process creator payouts manually
// ---------------------------------------------------------------------------

export async function moderatePayout(
  supabase: SupabaseClient,
  payoutId: string,
  action: 'processing' | 'pay' | 'fail' | 'hold' | 'cancel',
  note?: string
): Promise<CreatorPayout> {
  const admin = await resolveAdmin(supabase);

  const payout = await getPayoutById(supabase, payoutId);
  if (!payout) {
    throw new Error('Payout record not found');
  }

  const actionMap: Record<string, string> = {
    processing: 'processing',
    pay: 'paid',
    fail: 'failed',
    hold: 'on_hold',
    cancel: 'cancelled',
  };

  const status = actionMap[action];
  if (!status) throw new Error(`Invalid payout moderation action: ${action}`);

  const now = new Date().toISOString();

  const updateData: {
    status: string;
    admin_note: string | null;
    processing_started_at?: string | null;
    paid_at?: string | null;
  } = {
    status,
    admin_note: note ?? null,
  };

  if (status === 'processing') {
    updateData.processing_started_at = now;
  } else if (status === 'paid') {
    updateData.paid_at = now;
  }

  const updated = await updatePayoutStatus(supabase, payoutId, updateData);

  // Log to admin action log
  const actionTypeMap: Record<'processing' | 'pay' | 'fail' | 'hold' | 'cancel', 'payout_created' | 'payout_processing' | 'payout_paid' | 'payout_failed' | 'payout_on_hold'> = {
    processing: 'payout_processing',
    pay: 'payout_paid',
    fail: 'payout_failed',
    hold: 'payout_on_hold',
    cancel: 'payout_on_hold', // maps to a hold/cancel entry for audit safety
  };

  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: actionTypeMap[action],
    target_type: 'creator_payout',
    target_id: payoutId,
    note: note ?? null,
  });

  return updated;
}
