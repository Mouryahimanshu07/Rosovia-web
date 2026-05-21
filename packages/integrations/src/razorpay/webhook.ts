// packages/integrations/src/razorpay/webhook.ts
// Server-only. Webhook signature verification using Node.js crypto.

import { createHmac } from 'crypto';

/**
 * Verifies the Razorpay webhook signature.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret.
 * The signature is passed in the `x-razorpay-signature` header.
 *
 * IMPORTANT: rawBody must be the original raw string — do NOT parse JSON first.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;

  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (expectedSignature.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Gets the Razorpay webhook secret from environment variables.
 * Throws if not set — prevents silent verification bypass.
 */
export function getRazorpayWebhookSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'Missing RAZORPAY_WEBHOOK_SECRET environment variable.'
    );
  }
  return secret;
}
