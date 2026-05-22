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

export interface RazorpayRefundInput {
  paymentId: string;
  amountInPaise?: number;
  notes?: Record<string, string>;
}

export interface RazorpayRefundResult {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  notes?: Record<string, string>;
  receipt?: string | null;
  status: string;
  created_at: number;
}

/**
 * Creates a Razorpay Refund via the REST API.
 * Returns the Razorpay refund object containing the refund ID.
 */
export async function refundRazorpayPayment(
  input: RazorpayRefundInput
): Promise<RazorpayRefundResult> {
  const { keyId, keySecret } = getRazorpayCredentials();

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const body: Record<string, any> = {};
  if (input.amountInPaise !== undefined) {
    body.amount = input.amountInPaise;
  }
  if (input.notes) {
    body.notes = input.notes;
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${input.paymentId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay refund failed: ${error}`);
  }

  return response.json() as Promise<RazorpayRefundResult>;
}

/**
 * Returns the Razorpay Key ID for use in client-side Checkout.
 * Key ID is not a secret but is returned from server to avoid client env leakage.
 */
export function getRazorpayKeyId(): string {
  const { keyId } = getRazorpayCredentials();
  return keyId;
}

