// packages/integrations/src/razorpay/client.ts
// Server-only. Never import this in client components.
// Uses direct Razorpay REST API — no SDK runtime dependency needed on client.

export interface RazorpayOrderInput {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  created_at: number;
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
    );
  }

  return { keyId, keySecret };
}

/**
 * Creates a Razorpay Order via the REST API.
 * Returns the Razorpay order object containing the provider_order_id.
 */
export async function createRazorpayOrder(
  input: RazorpayOrderInput
): Promise<RazorpayOrderResult> {
  const { keyId, keySecret } = getRazorpayCredentials();

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay order creation failed: ${error}`);
  }

  return response.json() as Promise<RazorpayOrderResult>;
}

/**
 * Returns the Razorpay Key ID for use in client-side Checkout.
 * Key ID is not a secret but is returned from server to avoid client env leakage.
 */
export function getRazorpayKeyId(): string {
  const { keyId } = getRazorpayCredentials();
  return keyId;
}
