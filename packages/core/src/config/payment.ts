// packages/core/src/config/payment.ts

export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true';
}

export function isLivePaymentsEnabled(): boolean {
  return process.env.LIVE_PAYMENTS_ENABLED === 'true';
}
