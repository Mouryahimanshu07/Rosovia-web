import type { SupabaseClient } from '@supabase/supabase-js';
import type { Dispute, DisputeListParams } from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getDisputeById(
  supabase: SupabaseClient,
  id: string
): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch dispute: ${error.message}`);
  }
  return data as Dispute;
}

export async function getDisputeByOrderId(
  supabase: SupabaseClient,
  orderId: string
): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch dispute by order: ${error.message}`);
  return data as Dispute | null;
}

export async function listDisputesByOpenedBy(
  supabase: SupabaseClient,
  profileId: string,
  params: DisputeListParams = {}
): Promise<Dispute[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('disputes')
    .select('*')
    .eq('opened_by', profileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list disputes: ${error.message}`);
  return (data ?? []) as Dispute[];
}
