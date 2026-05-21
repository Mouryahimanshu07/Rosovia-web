import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Create payment for existing order (buyer-initiated)
//    Only orderId comes from client — amount/currency resolved server-side.
// ---------------------------------------------------------------------------

export const createPaymentForOrderSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// 2. Razorpay webhook event — validated after signature verification
// ---------------------------------------------------------------------------

const razorpayPaymentEntitySchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(3),
  status: z.enum(['captured', 'failed', 'authorized', 'created']),
  error_code: z.string().nullish(),
  error_description: z.string().nullish(),
});

export const razorpayWebhookEventSchema = z.object({
  event: z.string(),
  account_id: z.string().optional(),
  created_at: z.number().optional(),
  payload: z.object({
    payment: z
      .object({
        entity: razorpayPaymentEntitySchema,
      })
      .optional(),
    order: z
      .object({
        entity: z.object({
          id: z.string(),
          status: z.string(),
          amount: z.number(),
          currency: z.string(),
        }),
      })
      .optional(),
  }),
});

// ---------------------------------------------------------------------------
// 3. Payment list / filter params
// ---------------------------------------------------------------------------

export const paymentListParamsSchema = z.object({
  status: z
    .enum(['created', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'])
    .optional(),
  page: z.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type CreatePaymentForOrderSchemaInput = z.infer<typeof createPaymentForOrderSchema>;
export type RazorpayWebhookEventSchemaInput = z.infer<typeof razorpayWebhookEventSchema>;
export type PaymentListParamsSchemaInput = z.infer<typeof paymentListParamsSchema>;
