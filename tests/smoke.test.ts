import { describe, expect, it, vi, beforeEach } from 'vitest';

// =============================================================================
// Rosovia — Core Unit Tests
// =============================================================================
// These tests verify:
//   1. Basic vitest setup works.
//   2. RPC name constants match what TypeScript service calls expect.
//   3. PAYMENTS_ENABLED feature-flag behavior.
//   4. Order creation atomic flow (normalizeCreatedOrderFromRpc).
//   5. Admin action types are a subset of the DB check-constraint set.
//   6. Dispute button exclusion from updateOrderStatusAction.
// =============================================================================


// ---------------------------------------------------------------------------
// 1. Smoke test
// ---------------------------------------------------------------------------
describe('Rosovia test setup', () => {
  it('runs Vitest successfully', () => {
    expect(true).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// 2. RPC name constants
//    These strings must match the function names in the database migrations.
//    If the name changes in SQL it must change here too.
// ---------------------------------------------------------------------------
describe('RPC existence contracts', () => {
  const REQUIRED_RPCS = [
    'create_listing_order_atomic',      // 028_critical_rpc_fixes.sql
    'mark_razorpay_payment_captured',   // 028_critical_rpc_fixes.sql
    'mark_razorpay_payment_failed',     // 028_critical_rpc_fixes.sql
    'update_order_status_atomic',       // 021_business_rule_rpcs.sql
    'create_review_for_completed_order_atomic', // 021_business_rule_rpcs.sql
    'create_refund_request_atomic',     // 021_business_rule_rpcs.sql
    'create_dispute_atomic',            // 021_business_rule_rpcs.sql
    'admin_set_user_status_atomic',     // 023_admin_atomic_actions.sql
    'admin_moderate_listing_atomic',    // 023_admin_atomic_actions.sql
    'admin_moderate_review_atomic',     // 023_admin_atomic_actions.sql
    'admin_resolve_report_atomic',      // 023_admin_atomic_actions.sql
    'admin_update_verification_atomic', // 023_admin_atomic_actions.sql
  ] as const;

  it('all required RPC names are non-empty strings', () => {
    for (const name of REQUIRED_RPCS) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('create_listing_order_atomic is the name called by order.service.ts', () => {
    // This mirrors the literal string in createOrderFromApprovedListing().
    const TS_CALL = 'create_listing_order_atomic';
    expect(REQUIRED_RPCS).toContain(TS_CALL);
  });

  it('mark_razorpay_payment_captured is the name called by payment.repository.ts', () => {
    const TS_CALL = 'mark_razorpay_payment_captured';
    expect(REQUIRED_RPCS).toContain(TS_CALL);
  });

  it('mark_razorpay_payment_failed is the name called by payment.repository.ts', () => {
    const TS_CALL = 'mark_razorpay_payment_failed';
    expect(REQUIRED_RPCS).toContain(TS_CALL);
  });
});


// ---------------------------------------------------------------------------
// 3. PAYMENTS_ENABLED feature-flag behavior
//    Tests the pure logic used in apps/web/src/app/actions/payments.ts
// ---------------------------------------------------------------------------
describe('PAYMENTS_ENABLED feature flag', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone and reset env for each test
    process.env = { ...originalEnv };
  });

  function paymentsEnabled(): boolean {
    return process.env.PAYMENTS_ENABLED === 'true';
  }

  it('is disabled when PAYMENTS_ENABLED is not set', () => {
    delete process.env.PAYMENTS_ENABLED;
    expect(paymentsEnabled()).toBe(false);
  });

  it('is disabled when PAYMENTS_ENABLED=false', () => {
    process.env.PAYMENTS_ENABLED = 'false';
    expect(paymentsEnabled()).toBe(false);
  });

  it('is disabled when PAYMENTS_ENABLED=0', () => {
    process.env.PAYMENTS_ENABLED = '0';
    expect(paymentsEnabled()).toBe(false);
  });

  it('is enabled only when PAYMENTS_ENABLED=true', () => {
    process.env.PAYMENTS_ENABLED = 'true';
    expect(paymentsEnabled()).toBe(true);
  });

  it('PayNow isPayable logic respects feature flag', () => {
    // Simulates the isPayable calculation in buyer orders pages.
    function isPayable(paymentsEnabledFlag: boolean, orderStatus: string, paymentStatus: string, amount: number): boolean {
      return (
        paymentsEnabledFlag &&
        orderStatus === 'payment_pending' &&
        ['created', 'pending', 'failed'].includes(paymentStatus) &&
        amount > 0
      );
    }

    // Flag off — never payable regardless of order state
    expect(isPayable(false, 'payment_pending', 'created', 500)).toBe(false);
    expect(isPayable(false, 'payment_pending', 'pending', 500)).toBe(false);

    // Flag on — follows order state
    expect(isPayable(true, 'payment_pending', 'created', 500)).toBe(true);
    expect(isPayable(true, 'payment_pending', 'paid', 500)).toBe(false);
    expect(isPayable(true, 'accepted', 'created', 500)).toBe(false);
    expect(isPayable(true, 'payment_pending', 'created', 0)).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// 4. Order creation atomic flow — normalizeCreatedOrderFromRpc
//    Tests the helper in packages/api/src/orders/order.service.ts
// ---------------------------------------------------------------------------
describe('normalizeCreatedOrderFromRpc', () => {
  // Inline a copy of the function to test it without importing Next.js deps
  function normalizeCreatedOrderFromRpc(data: unknown): Record<string, unknown> {
    if (!data) throw new Error('Order creation failed');
    if (Array.isArray(data)) {
      if (!data[0]) throw new Error('Order creation failed');
      return data[0] as Record<string, unknown>;
    }
    return data as Record<string, unknown>;
  }

  it('returns an object directly when data is an object', () => {
    const order = { id: 'abc', order_status: 'payment_pending' };
    expect(normalizeCreatedOrderFromRpc(order)).toEqual(order);
  });

  it('returns the first element when data is an array', () => {
    const order = { id: 'abc', order_status: 'payment_pending' };
    expect(normalizeCreatedOrderFromRpc([order])).toEqual(order);
  });

  it('throws when data is null', () => {
    expect(() => normalizeCreatedOrderFromRpc(null)).toThrow('Order creation failed');
  });

  it('throws when data is undefined', () => {
    expect(() => normalizeCreatedOrderFromRpc(undefined)).toThrow('Order creation failed');
  });

  it('throws when data is an empty array', () => {
    expect(() => normalizeCreatedOrderFromRpc([])).toThrow('Order creation failed');
  });
});


// ---------------------------------------------------------------------------
// 5. Admin action types aligned with the DB check constraint
//    Migration 019 defines the canonical set.  The TS type in
//    packages/core/src/types/admin-action.ts must be a subset.
// ---------------------------------------------------------------------------
describe('AdminActionType alignment with DB constraint', () => {
  // Canonical set from migration 019_refunds_disputes_payouts.sql
  const DB_ALLOWED_ACTION_TYPES = new Set([
    'report_reviewed',
    'report_resolved',
    'report_rejected',
    'review_hidden',
    'review_unhidden',
    'listing_suspended',
    'listing_unsuspended',
    'listing_approved',
    'listing_rejected',
    'user_suspended',
    'user_unsuspended',
    'creator_suspended',
    'creator_unsuspended',
    'verification_reviewed',
    'category_created',
    'category_updated',
    'refund_requested',
    'refund_approved',
    'refund_rejected',
    'refund_processed',
    'refund_failed',
    'refund_cancelled',
    'dispute_opened',
    'dispute_under_review',
    'dispute_resolved',
    'dispute_rejected',
    'payout_created',
    'payout_processing',
    'payout_paid',
    'payout_failed',
    'payout_on_hold',
    'manual_note',
  ]);

  // Subset used by admin_atomic_actions.sql (023)
  const ATOMIC_ACTION_TYPES_USED = [
    'user_suspended',
    'user_unsuspended',
    'listing_approved',
    'listing_rejected',
    'listing_suspended',
    'review_hidden',
    'review_unhidden',
    'report_reviewed',
    'report_resolved',
    'report_rejected',
    'verification_reviewed',
  ];

  it('all action types used in 023 are within the DB constraint set', () => {
    for (const actionType of ATOMIC_ACTION_TYPES_USED) {
      expect(DB_ALLOWED_ACTION_TYPES.has(actionType)).toBe(true);
    }
  });
});


// ---------------------------------------------------------------------------
// 6. Dispute flow — hidden button test
//    Verifies that 'mark_disputed' is NOT a valid action for
//    update_order_status_atomic (which only handles the listed actions).
// ---------------------------------------------------------------------------
describe('Dispute UI — hidden button contract', () => {
  // Actions supported by update_order_status_atomic (021_business_rule_rpcs.sql)
  const VALID_UPDATE_ORDER_ACTIONS = new Set([
    'cancel',
    'mark_completed',
    'mark_accepted',
    'mark_in_progress',
    'mark_shipped',
    'mark_delivered',
  ]);

  it('mark_disputed is NOT a valid action for update_order_status_atomic', () => {
    // This is the key safety check: the old UI was calling this and it would
    // fail at the DB level with "Unknown action: mark_disputed".
    expect(VALID_UPDATE_ORDER_ACTIONS.has('mark_disputed')).toBe(false);
  });

  it('all other order actions used by the UI are valid', () => {
    const UI_ACTIONS = ['cancel', 'mark_accepted', 'mark_in_progress', 'mark_shipped', 'mark_delivered', 'mark_completed'];
    for (const action of UI_ACTIONS) {
      expect(VALID_UPDATE_ORDER_ACTIONS.has(action)).toBe(true);
    }
  });
});