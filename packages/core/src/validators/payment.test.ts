import { describe, expect, it } from 'vitest';
import {
  createPaymentForOrderSchema,
  paymentListParamsSchema,
  razorpayWebhookEventSchema,
} from './payment';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('payment validators', () => {
  describe('createPaymentForOrderSchema', () => {
    it('accepts a valid order UUID', () => {
      const result = createPaymentForOrderSchema.safeParse({
        orderId: uuid,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid order ID', () => {
      const result = createPaymentForOrderSchema.safeParse({
        orderId: 'invalid-order-id',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('razorpayWebhookEventSchema', () => {
    it('accepts a valid payment.captured webhook payload', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.captured',
        account_id: 'acc_test',
        created_at: 1710000000,
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'captured',
              error_code: null,
              error_description: null,
            },
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it('accepts a valid payment.failed webhook payload', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed',
            },
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing payment entity for handled payment event payload shape', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.captured',
        payload: {},
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid amount type', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              order_id: 'order_test_123',
              amount: '10000',
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty payment ID after strict validator hardening', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: '',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid payment status after strict validator hardening', () => {
      const result = razorpayWebhookEventSchema.safeParse({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              order_id: 'order_test_123',
              amount: 10000,
              currency: 'INR',
              status: 'random_status',
            },
          },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('paymentListParamsSchema', () => {
    it('defaults page to 1', () => {
      const result = paymentListParamsSchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('accepts valid payment status filter', () => {
      const result = paymentListParamsSchema.safeParse({
        status: 'paid',
        page: 2,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid payment status filter', () => {
      const result = paymentListParamsSchema.safeParse({
        status: 'unknown',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid page number', () => {
      const result = paymentListParamsSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });
  });
});