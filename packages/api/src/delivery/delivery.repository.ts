import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderDelivery } from '@rosovia/core';

/**
 * Fetch a delivery record by order ID.
 */
export async function getDeliveryByOrderId(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderDelivery | null> {
  const { data, error } = await supabase
    .from('order_deliveries')
    .select('*')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch order delivery: ${error.message}`);
  }
  return data as OrderDelivery | null;
}

/**
 * Upsert an order delivery record.
 */
export async function upsertDelivery(
  supabase: SupabaseClient,
  data: Partial<OrderDelivery> & {
    order_id: string;
    creator_id: string;
    buyer_id: string;
  }
): Promise<OrderDelivery> {
  const { data: created, error } = await supabase
    .from('order_deliveries')
    .upsert({
      ...data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'order_id',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to upsert order delivery: ${error.message}`);
  }
  return created as OrderDelivery;
}

/**
 * Update specific fields on an order delivery record.
 */
export async function updateDeliveryFields(
  supabase: SupabaseClient,
  orderId: string,
  data: Partial<Omit<OrderDelivery, 'id' | 'order_id' | 'creator_id' | 'buyer_id' | 'created_at'>>
): Promise<OrderDelivery> {
  const { data: updated, error } = await supabase
    .from('order_deliveries')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update order delivery fields: ${error.message}`);
  }
  return updated as OrderDelivery;
}
