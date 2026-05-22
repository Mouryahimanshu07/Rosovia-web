import type { SupabaseClient } from '@supabase/supabase-js';
import type { RefundRequest, RefundListParams } from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getRefundRequestById(
  supabase: SupabaseClient,
  id: string
): Promise<RefundRequest | null> {
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch refund request: ${error.message}`);
  }
  return data as RefundRequest;
}

export async function listRefundRequestsByBuyerId(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: RefundListParams = {}
): Promise<RefundRequest[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('refund_requests')
    .select('*')
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list refund requests: ${error.message}`);
  return (data ?? []) as RefundRequest[];
}

export async function listRefundRequestsByOrderId(
  supabase: SupabaseClient,
  orderId: string
): Promise<RefundRequest[]> {
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list refund requests for order: ${error.message}`);
  return (data ?? []) as RefundRequest[];
}

export async function listAllRefundRequestsForAdmin(
  supabase: SupabaseClient,
  params: RefundListParams = {}
): Promise<RefundRequest[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('refund_requests')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list all refund requests for admin: ${error.message}`);
  return (data ?? []) as RefundRequest[];
}

export async function updateRefundRequestStatus(
  supabase: SupabaseClient,
  refundId: string,
  data: {
    status: string;
    admin_note?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    processed_at?: string | null;
    failure_reason?: string | null;
  }
): Promise<RefundRequest> {
  const { data: updated, error } = await supabase
    .from('refund_requests')
    .update(data)
    .eq('id', refundId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update refund request: ${error.message}`);
  }
  return updated as RefundRequest;
}

