import { describe, expect, it } from 'vitest';
import {
  refundAdminUpdateSchema,
  refundListParamsSchema,
  refundRequestCreateSchema,
} from './refund';

const orderId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const refundRequestId = '33333333-3333-4333-8333-333333333333';

describe('refund validators', () => {
  describe('refundRequestCreateSchema', () => {
    it('accepts valid refund request', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId,
        amount: 250,
        reason: 'not_delivered',
        description: 'The product was not delivered.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid order ID', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId: 'bad-order-id',
        paymentId,
        amount: 250,
        reason: 'not_delivered',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid payment ID', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId: 'bad-payment-id',
        amount: 250,
        reason: 'not_delivered',
      });

      expect(result.success).toBe(false);
    });

    it('rejects zero amount', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId,
        amount: 0,
        reason: 'not_delivered',
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative amount', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId,
        amount: -10,
        reason: 'not_delivered',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid refund reason', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId,
        amount: 250,
        reason: 'changed_mind_after_months',
      });

      expect(result.success).toBe(false);
    });

    it('rejects description longer than 2000 characters', () => {
      const result = refundRequestCreateSchema.safeParse({
        orderId,
        paymentId,
        amount: 250,
        reason: 'other',
        description: 'x'.repeat(2001),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('refundAdminUpdateSchema', () => {
    it('accepts valid admin refund approval', () => {
      const result = refundAdminUpdateSchema.safeParse({
        refundRequestId,
        status: 'approved',
        adminNote: 'Refund approved after review.',
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid processed refund with provider refund ID', () => {
      const result = refundAdminUpdateSchema.safeParse({
        refundRequestId,
        status: 'processed',
        providerRefundId: 'rfnd_test_123',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid refund request ID', () => {
      const result = refundAdminUpdateSchema.safeParse({
        refundRequestId: 'bad-id',
        status: 'approved',
      });

      expect(result.success).toBe(false);
    });

    it('rejects requested status for admin update', () => {
      const result = refundAdminUpdateSchema.safeParse({
        refundRequestId,
        status: 'requested',
      });

      expect(result.success).toBe(false);
    });

    it('rejects overly long admin note', () => {
      const result = refundAdminUpdateSchema.safeParse({
        refundRequestId,
        status: 'rejected',
        adminNote: 'x'.repeat(2001),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('refundListParamsSchema', () => {
    it('defaults page to 1', () => {
      const result = refundListParamsSchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('accepts valid status filter', () => {
      const result = refundListParamsSchema.safeParse({
        status: 'requested',
        page: 2,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid status filter', () => {
      const result = refundListParamsSchema.safeParse({
        status: 'unknown',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid page', () => {
      const result = refundListParamsSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });
  });
});