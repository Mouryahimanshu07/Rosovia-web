export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

export function calculatePlatformFee(amount: number, percent = DEFAULT_PLATFORM_FEE_PERCENT) {
  return Number(((amount * percent) / 100).toFixed(2));
}

export function calculateSellerAmount(amount: number, platformFee: number) {
  return Number((amount - platformFee).toFixed(2));
}