// Payment types for Rosovia Module 11: Payments
// PaymentStatus is re-exported from order.ts (already in core index)

import type { PaymentStatus } from './order';

export type PaymentProvider = 'razorpay';

export interface Payment {
  id: string;
  order_id: string;
  provider: PaymentProvider;
  provider_payment_id: string | null;
  provider_order_id: string | null;
  provider_payment_link_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  webhook_received: boolean;
  webhook_event_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input from the buyer client to initiate a payment for an existing order. */
export interface CreatePaymentForOrderInput {
  orderId: string;
}

/**
 * Data returned to the client to open Razorpay Checkout.
 * Never contains secret keys.
 */
export interface RazorpayCheckoutData {
  /** Razorpay publishable key ID — safe for client */
  razorpayKeyId: string;
  /** Razorpay order ID (provider_order_id) to pass to checkout */
  providerOrderId: string;
  /** Amount in paise (Indian subunit) */
  amountInPaise: number;
  currency: string;
  /** Internal Rosovia order ID */
  orderId: string;
  /** Internal Rosovia payment row ID */
  appPaymentId: string;
}

// ---------------------------------------------------------------------------
// Razorpay webhook event types (minimal — only what we handle)
// ---------------------------------------------------------------------------

export interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  error_code?: string | null;
  error_description?: string | null;
}

export interface RazorpayWebhookEvent {
  event: string;
  account_id?: string;
  created_at?: number;
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    order?: {
      entity: {
        id: string;
        status: string;
        amount: number;
        currency: string;
      };
    };
  };
}
