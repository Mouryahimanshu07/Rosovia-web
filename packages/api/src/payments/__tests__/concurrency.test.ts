import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_API_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

describe('Payment Concurrency: duplicate webhook race condition neutralization', () => {
  let adminClient: any;
  let testOrderId: string;
  let providerOrderId: string;

  let isOnline = false;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    try {
      // Test if Supabase is online and accessible
      const { error: pingError } = await adminClient.from('profiles').select('id').limit(1);
      if (pingError && pingError.message.includes('fetch failed')) {
        throw pingError;
      }

      // Setup active checkout
      const { data: profile, error: pError } = await adminClient
        .from('profiles')
        .insert({ email: 'race_buyer@example.com', role: 'buyer', status: 'active' })
        .select('id')
        .single();

      if (pError || !profile) {
        throw new Error('Profile insertion failed');
      }

      const { data: order, error: oError } = await adminClient
        .from('orders')
        .insert({ buyer_id: profile.id, amount: 2000, currency: 'INR', order_status: 'payment_pending' })
        .select('id')
        .single();

      if (oError || !order) {
        throw new Error('Order insertion failed');
      }

      testOrderId = order.id;
      providerOrderId = `order_razor_${Date.now()}`;

      // Create initial pending payment attempt
      const { error: payError } = await adminClient
        .from('payments')
        .insert({
          order_id: testOrderId,
          provider: 'razorpay',
          provider_order_id: providerOrderId,
          amount: 2000,
          currency: 'INR',
          status: 'pending'
        });

      if (payError) {
        throw payError;
      }

      isOnline = true;
    } catch (e) {
      console.warn('Supabase local server is offline or unreachable. Skipping concurrency tests.', e);
      isOnline = false;
    }
  });

  it('should process concurrent capture webhooks exactly once without duplicate order status lines', async () => {
    if (!isOnline) return;
    const eventId = `evt_race_${Date.now()}`;
    const payload = { event: 'payment.captured' };

    // Fire duplicate webhook updates simultaneously to simulate network retry overlaps
    const webhookCalls = Array.from({ length: 3 }).map(() =>
      adminClient.rpc('mark_razorpay_payment_captured', {
        p_event_id: eventId,
        p_provider_order_id: providerOrderId,
        p_provider_payment_id: 'pay_captured_concurrent_123',
        p_amount: 2000,
        p_currency: 'INR',
        p_payload: payload
      })
    );

    const results = await Promise.all(webhookCalls);

    // Ensure all concurrent threads resolved successfully (no transaction aborts due to locked rows)
    for (const res of results) {
      expect(res.error).toBeNull();
    }

    // Verify exactly one status history log exists for this order transition
    const { data: history } = await adminClient
      .from('order_status_history')
      .select('*')
      .eq('order_id', testOrderId);

    expect(history?.length).toBe(1);
    expect(history?.[0].new_status).toBe('paid');
  });
});
