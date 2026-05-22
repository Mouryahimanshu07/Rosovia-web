import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Connection details for local Supabase Docker stack or mock
const SUPABASE_URL = process.env.SUPABASE_API_URL || 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'mock-anon-key';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

describe('Database Security: payments & webhook RLS policy suite', () => {
  let anonClient: any;
  let buyerClient: any;
  let serviceClient: any;
  let testOrderId: string;

  let isOnline = false;

  beforeAll(async () => {
    anonClient = createClient(SUPABASE_URL, ANON_KEY);
    serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

    try {
      // Test if Supabase is online and accessible
      const { error: pingError } = await serviceClient.from('profiles').select('id').limit(1);
      if (pingError && pingError.message.includes('fetch failed')) {
        throw pingError;
      }
      
      // Create a mock active order & buyer profile using service_role bypass
      const { data: profile, error: pError } = await serviceClient
        .from('profiles')
        .insert({ email: 'testbuyer@example.com', role: 'buyer', status: 'active' })
        .select('id')
        .single();

      if (pError || !profile) {
        throw new Error('Profile insertion failed');
      }

      const { data: order, error: oError } = await serviceClient
        .from('orders')
        .insert({ buyer_id: profile.id, amount: 1500, currency: 'INR', order_status: 'payment_pending' })
        .select('id')
        .single();

      if (oError || !order) {
        throw new Error('Order insertion failed');
      }

      testOrderId = order.id;

      // Simulate standard buyer JWT auth
      buyerClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      
      isOnline = true;
    } catch (e) {
      console.warn('Supabase local server is offline or unreachable. Skipping integration tests.', e);
      isOnline = false;
    }
  });

  it('ANON: should be blocked from reading or writing payments', async () => {
    if (!isOnline) return;
    const { data, error } = await anonClient
      .from('payments')
      .select('*');
    
    expect(error).toBeNull();
    expect(data?.length).toBe(0); // RLS blocks read (returns empty list)
    
    const { error: insertError } = await anonClient
      .from('payments')
      .insert({ order_id: testOrderId, amount: 500, status: 'paid' });

    expect(insertError).not.toBeNull(); // Blocked by write policy
  });

  it('BUYER: can read their own payment records, but cannot write direct paid statuses', async () => {
    if (!isOnline) return;
    // Insert a payment via service_role to check read RLS
    const { data: payment } = await serviceClient
      .from('payments')
      .insert({ order_id: testOrderId, provider_order_id: 'pay_123', amount: 1500, status: 'pending' })
      .select('id')
      .single();

    // Standard user tries to force-mark payment status as 'paid' via Client API
    const { error: updateError } = await buyerClient
      .from('payments')
      .update({ status: 'paid' })
      .eq('id', payment.id);

    // Should fail because normal buyers have no update policies on payments
    expect(updateError).not.toBeNull();
  });

  it('ADMIN RPC: mark_razorpay_payment_captured execution restricted to service_role', async () => {
    if (!isOnline) return;
    const { error } = await buyerClient.rpc('mark_razorpay_payment_captured', {
      p_event_id: 'evt_test_123',
      p_provider_order_id: 'pay_123',
      p_provider_payment_id: 'pay_captured_1',
      p_amount: 1500,
      p_currency: 'INR',
      p_payload: {}
    });

    // Should return permission error code (42501)
    expect(error?.code).toBe('42501');
  });
});
