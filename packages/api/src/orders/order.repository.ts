import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Order,
  OrderWithDetails,
  OrderStatus,
  OrderStatusHistory,
  OrderListParams,
  PaymentStatus,
} from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal: flatten joined row into OrderWithDetails
// ---------------------------------------------------------------------------

type RawOrderRow = Order & {
  profiles?: { full_name: string | null; username: string | null } | null;
  creator_profiles?: { display_name: string; slug: string } | null;
  listings?: { title: string } | null;
  custom_orders?: { title: string } | null;
};

function flattenOrder(row: RawOrderRow): OrderWithDetails {
  return {
    ...row,
    buyer_full_name: row.profiles?.full_name ?? null,
    buyer_username: row.profiles?.username ?? null,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    listing_title: row.listings?.title ?? null,
    custom_order_title: row.custom_orders?.title ?? null,
  };
}

const WITH_DETAILS_SELECT =
  '*, profiles ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title ), custom_orders ( title )';

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getOrderById(
  supabase: SupabaseClient,
  id: string
): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
  return data as Order;
}

export async function getOrderByCustomOrderId(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('custom_order_id', customOrderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch order by custom order ID: ${error.message}`);
  return data as Order | null;
}

export async function getOrderForBuyer(
  supabase: SupabaseClient,
  orderId: string,
  buyerProfileId: string
): Promise<OrderWithDetails | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(WITH_DETAILS_SELECT)
    .eq('id', orderId)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
  return flattenOrder(data as RawOrderRow);
}

export async function getOrderForCreator(
  supabase: SupabaseClient,
  orderId: string,
  creatorProfileId: string
): Promise<OrderWithDetails | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(WITH_DETAILS_SELECT)
    .eq('id', orderId)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
  return flattenOrder(data as RawOrderRow);
}

export async function listCurrentBuyerOrders(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: OrderListParams = {}
): Promise<OrderWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('orders')
    .select(WITH_DETAILS_SELECT)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('order_status', params.status);
  if (params.paymentStatus) query = query.eq('payment_status', params.paymentStatus);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list buyer orders: ${error.message}`);
  return (data ?? []).map((r) => flattenOrder(r as RawOrderRow));
}

export async function listCurrentCreatorOrders(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: OrderListParams = {}
): Promise<OrderWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('orders')
    .select(WITH_DETAILS_SELECT)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('order_status', params.status);
  if (params.paymentStatus) query = query.eq('payment_status', params.paymentStatus);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creator orders: ${error.message}`);
  return (data ?? []).map((r) => flattenOrder(r as RawOrderRow));
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export async function createOrder(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    listing_id?: string | null;
    custom_order_id?: string | null;
    amount: number;
    platform_fee: number;
    seller_amount: number;
    currency: string;
    order_status: OrderStatus;
    payment_status: PaymentStatus;
  }
): Promise<Order> {
  const { data: created, error } = await supabase
    .from('orders')
    .insert({
      ...data,
      listing_id: data.listing_id ?? null,
      custom_order_id: data.custom_order_id ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create order: ${error.message}`);
  return created as Order;
}

export async function updateOrder(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    delivery_status: string | null;
  }>
): Promise<Order> {
  const { data: updated, error } = await supabase
    .from('orders')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update order: ${error.message}`);
  return updated as Order;
}

// ---------------------------------------------------------------------------
// Order status history helpers
// ---------------------------------------------------------------------------

export async function createOrderStatusHistory(
  supabase: SupabaseClient,
  data: {
    order_id: string;
    old_status: OrderStatus | null;
    new_status: OrderStatus;
    changed_by: string;
    note?: string | null;
  }
): Promise<OrderStatusHistory> {
  const { data: created, error } = await supabase
    .from('order_status_history')
    .insert({
      order_id: data.order_id,
      old_status: data.old_status,
      new_status: data.new_status,
      changed_by: data.changed_by,
      note: data.note ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create order status history: ${error.message}`);
  return created as OrderStatusHistory;
}

export async function listOrderStatusHistory(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderStatusHistory[]> {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list order status history: ${error.message}`);
  return (data ?? []) as OrderStatusHistory[];
}
