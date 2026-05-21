import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CustomOrder,
  CustomOrderWithDetails,
  CustomOrderStatus,
  CustomOrderListParams,
} from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal: flatten joined row into CustomOrderWithDetails
// ---------------------------------------------------------------------------

type RawCustomOrderRow = CustomOrder & {
  profiles?: { full_name: string | null; username: string | null } | null;
  creator_profiles?: { display_name: string; slug: string } | null;
  listings?: { title: string } | null;
  categories?: { name: string } | null;
};

function flattenCustomOrder(row: RawCustomOrderRow): CustomOrderWithDetails {
  return {
    ...row,
    buyer_full_name: row.profiles?.full_name ?? null,
    buyer_username: row.profiles?.username ?? null,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    listing_title: row.listings?.title ?? null,
    category_name: row.categories?.name ?? null,
  };
}

const WITH_DETAILS_SELECT =
  '*, profiles ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title ), categories ( name )';

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getCustomOrderById(
  supabase: SupabaseClient,
  id: string
): Promise<CustomOrder | null> {
  const { data, error } = await supabase
    .from('custom_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch custom order: ${error.message}`);
  }
  return data as CustomOrder;
}

export async function getCustomOrderForBuyer(
  supabase: SupabaseClient,
  customOrderId: string,
  buyerProfileId: string
): Promise<CustomOrder | null> {
  const { data, error } = await supabase
    .from('custom_orders')
    .select('*')
    .eq('id', customOrderId)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch custom order: ${error.message}`);
  }
  return data as CustomOrder;
}

export async function getCustomOrderForCreator(
  supabase: SupabaseClient,
  customOrderId: string,
  creatorProfileId: string
): Promise<CustomOrder | null> {
  const { data, error } = await supabase
    .from('custom_orders')
    .select('*')
    .eq('id', customOrderId)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch custom order: ${error.message}`);
  }
  return data as CustomOrder;
}

export async function listCurrentBuyerCustomOrders(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('custom_orders')
    .select(WITH_DETAILS_SELECT)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list buyer custom orders: ${error.message}`);
  return (data ?? []).map((r) => flattenCustomOrder(r as RawCustomOrderRow));
}

export async function listCurrentCreatorCustomOrders(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('custom_orders')
    .select(WITH_DETAILS_SELECT)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creator custom orders: ${error.message}`);
  return (data ?? []).map((r) => flattenCustomOrder(r as RawCustomOrderRow));
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export async function createCustomOrder(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    listing_id?: string | null;
    category_id: string;
    title: string;
    description: string;
    reference_media_id?: string | null;
    budget_min?: number | null;
    budget_max?: number | null;
    deadline?: string | null;
    delivery_city?: string | null;
    delivery_state?: string | null;
  }
): Promise<CustomOrder> {
  const { data: created, error } = await supabase
    .from('custom_orders')
    .insert({
      ...data,
      listing_id: data.listing_id ?? null,
      reference_media_id: data.reference_media_id ?? null,
      budget_min: data.budget_min ?? null,
      budget_max: data.budget_max ?? null,
      deadline: data.deadline ?? null,
      delivery_city: data.delivery_city ?? null,
      delivery_state: data.delivery_state ?? null,
      status: 'requested',
      creator_quote_amount: null,
      creator_quote_note: null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create custom order: ${error.message}`);
  return created as CustomOrder;
}

export async function updateCustomOrder(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    status: CustomOrderStatus;
    creator_quote_amount: number | null;
    creator_quote_note: string | null;
  }>
): Promise<CustomOrder> {
  const { data: updated, error } = await supabase
    .from('custom_orders')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update custom order: ${error.message}`);
  return updated as CustomOrder;
}
