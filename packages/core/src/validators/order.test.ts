import { describe, expect, it } from 'vitest';
import {
  createListingOrderSchema,
  createCustomOrderOrderSchema,
  orderStatusUpdateSchema,
  orderListParamsSchema,
} from './order';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('order validators', () => {
  describe('createListingOrderSchema', () => {
    it('accepts a valid listing UUID', () => {
      const result = createListingOrderSchema.safeParse({
        listingId: uuid,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid listing ID', () => {
      const result = createListingOrderSchema.safeParse({
        listingId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing listing ID', () => {
      const result = createListingOrderSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('createCustomOrderOrderSchema', () => {
    it('accepts a valid custom order UUID', () => {
      const result = createCustomOrderOrderSchema.safeParse({
        customOrderId: uuid,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid custom order ID', () => {
      const result = createCustomOrderOrderSchema.safeParse({
        customOrderId: 'bad-id',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('orderStatusUpdateSchema', () => {
    it('accepts valid order status action', () => {
      const result = orderStatusUpdateSchema.safeParse({
        orderId: uuid,
        action: 'mark_in_progress',
        note: 'Creator started work.',
      });

      expect(result.success).toBe(true);
    });

    it('accepts all allowed actions', () => {
      const allowedActions = [
        'cancel',
        'mark_accepted',
        'mark_in_progress',
        'mark_shipped',
        'mark_delivered',
        'mark_completed',
        'mark_disputed',
      ];

      for (const action of allowedActions) {
        const result = orderStatusUpdateSchema.safeParse({
          orderId: uuid,
          action,
        });

        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid action', () => {
      const result = orderStatusUpdateSchema.safeParse({
        orderId: uuid,
        action: 'mark_refunded',
      });

      expect(result.success).toBe(false);
    });

    it('rejects note longer than 1000 characters', () => {
      const result = orderStatusUpdateSchema.safeParse({
        orderId: uuid,
        action: 'cancel',
        note: 'x'.repeat(1001),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('orderListParamsSchema', () => {
    it('defaults page to 1', () => {
      const result = orderListParamsSchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('accepts valid status and paymentStatus filters', () => {
      const result = orderListParamsSchema.safeParse({
        status: 'in_progress',
        paymentStatus: 'paid',
        page: 2,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid page number', () => {
      const result = orderListParamsSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid order status filter', () => {
      const result = orderListParamsSchema.safeParse({
        status: 'unknown_status',
      });

      expect(result.success).toBe(false);
    });
  });
});