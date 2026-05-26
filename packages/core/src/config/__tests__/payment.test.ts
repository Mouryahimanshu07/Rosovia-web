// packages/core/src/config/__tests__/payment.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { isPaymentsEnabled, isLivePaymentsEnabled } from '../payment';

describe('Payment Configuration Helper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults payments to disabled when PAYMENTS_ENABLED is not defined or set to false', () => {
    delete process.env.PAYMENTS_ENABLED;
    expect(isPaymentsEnabled()).toBe(false);

    process.env.PAYMENTS_ENABLED = 'false';
    expect(isPaymentsEnabled()).toBe(false);
  });

  it('enables payments only when PAYMENTS_ENABLED is set to true', () => {
    process.env.PAYMENTS_ENABLED = 'true';
    expect(isPaymentsEnabled()).toBe(true);
  });

  it('defaults live payments to disabled when LIVE_PAYMENTS_ENABLED is not defined or set to false', () => {
    delete process.env.LIVE_PAYMENTS_ENABLED;
    expect(isLivePaymentsEnabled()).toBe(false);

    process.env.LIVE_PAYMENTS_ENABLED = 'false';
    expect(isLivePaymentsEnabled()).toBe(false);
  });

  it('enables live payments only when LIVE_PAYMENTS_ENABLED is set to true', () => {
    process.env.LIVE_PAYMENTS_ENABLED = 'true';
    expect(isLivePaymentsEnabled()).toBe(true);
  });
});
