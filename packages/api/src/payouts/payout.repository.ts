import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorPayout, PayoutListParams } from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getPayoutById(
  supabase: SupabaseClient,
  id: string
): Promise<CreatorPayout | null> {
  const { data, error } = await supabase
    .from('creator_payouts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch payout record: ${error.message}`);
  }
  return data as CreatorPayout;
}

export async function listPayoutsByCreatorId(
  supabase: SupabaseClient,
  creatorId: string,
  params: PayoutListParams = {}
): Promise<CreatorPayout[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_payouts')
    .select('*')
    .eq('creator_id', creatorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list payouts for creator: ${error.message}`);
  return (data ?? []) as CreatorPayout[];
}

export async function listAllPayoutsForAdmin(
  supabase: SupabaseClient,
  params: PayoutListParams = {}
): Promise<CreatorPayout[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_payouts')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list all payouts for admin: ${error.message}`);
  return (data ?? []) as CreatorPayout[];
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function updatePayoutStatus(
  supabase: SupabaseClient,
  payoutId: string,
  data: {
    status: string;
    provider?: string | null;
    provider_reference?: string | null;
    failure_reason?: string | null;
    admin_note?: string | null;
    processing_started_at?: string | null;
    paid_at?: string | null;
  }
): Promise<CreatorPayout> {
  const { data: updated, error } = await supabase
    .from('creator_payouts')
    .update(data)
    .eq('id', payoutId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update payout status: ${error.message}`);
  }
  return updated as CreatorPayout;
}
