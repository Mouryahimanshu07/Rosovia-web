import { describe, expect, it } from 'vitest';
import {
  disputeAdminUpdateSchema,
  disputeCreateSchema,
  disputeListParamsSchema,
} from './dispute';

const orderId = '11111111-1111-4111-8111-111111111111';
const disputeId = '22222222-2222-4222-8222-222222222222';

describe('dispute validators', () => {
  describe('disputeCreateSchema', () => {
    it('accepts valid dispute create input', () => {
      const result = disputeCreateSchema.safeParse({
        orderId,
        reason: 'not_delivered',
        description: 'The buyer did not receive the product.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid order ID', () => {
      const result = disputeCreateSchema.safeParse({
        orderId: 'bad-order-id',
        reason: 'not_delivered',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid dispute reason', () => {
      const result = disputeCreateSchema.safeParse({
        orderId,
        reason: 'random_reason',
      });

      expect(result.success).toBe(false);
    });

    it('rejects description longer than 3000 characters', () => {
      const result = disputeCreateSchema.safeParse({
        orderId,
        reason: 'other',
        description: 'x'.repeat(3001),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('disputeAdminUpdateSchema', () => {
    it('accepts valid under_review update', () => {
      const result = disputeAdminUpdateSchema.safeParse({
        disputeId,
        status: 'under_review',
        resolutionNote: 'Admin is reviewing this dispute.',
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid resolved update', () => {
      const result = disputeAdminUpdateSchema.safeParse({
        disputeId,
        status: 'resolved',
        resolutionNote: 'Resolved in favor of the buyer.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid dispute ID', () => {
      const result = disputeAdminUpdateSchema.safeParse({
        disputeId: 'bad-id',
        status: 'resolved',
      });

      expect(result.success).toBe(false);
    });

    it('rejects open status for admin update', () => {
      const result = disputeAdminUpdateSchema.safeParse({
        disputeId,
        status: 'open',
      });

      expect(result.success).toBe(false);
    });

    it('rejects overly long resolution note', () => {
      const result = disputeAdminUpdateSchema.safeParse({
        disputeId,
        status: 'rejected',
        resolutionNote: 'x'.repeat(3001),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('disputeListParamsSchema', () => {
    it('defaults page to 1', () => {
      const result = disputeListParamsSchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('accepts valid status filter', () => {
      const result = disputeListParamsSchema.safeParse({
        status: 'under_review',
        page: 2,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid status filter', () => {
      const result = disputeListParamsSchema.safeParse({
        status: 'unknown',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid page', () => {
      const result = disputeListParamsSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });
  });
});