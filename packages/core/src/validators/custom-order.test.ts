import { describe, expect, it } from 'vitest';
import { customOrderCreateSchema, creatorQuoteCustomOrderSchema, customOrderStatusUpdateSchema } from './custom-order';

describe('Custom Order Validators', () => {
  const CREATOR_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';
  const CATEGORY_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
  const CUSTOM_ORDER_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';

  describe('customOrderCreateSchema', () => {
    const validPayload = {
      creatorId: CREATOR_ID,
      categoryId: CATEGORY_ID,
      title: 'Handcrafted Wooden Coffee Table',
      description: 'I would like a custom table with walnut finishing and steel hairpin legs, about 4x2 feet.',
      budgetMin: 5000,
      budgetMax: 8000,
      deadline: '2026-06-30',
      deliveryCity: 'Bangalore',
      deliveryState: 'Karnataka',
    };

    it('successfully parses valid custom order requests', () => {
      const res = customOrderCreateSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.title).toBe('Handcrafted Wooden Coffee Table');
        expect(res.data.budgetMax).toBe(8000);
      }
    });

    it('rejects budgetMax less than budgetMin', () => {
      const res = customOrderCreateSchema.safeParse({
        ...validPayload,
        budgetMin: 5000,
        budgetMax: 3000,
      });
      expect(res.success).toBe(false);
    });

    it('rejects titles shorter than 3 characters', () => {
      const res = customOrderCreateSchema.safeParse({
        ...validPayload,
        title: 'ab',
      });
      expect(res.success).toBe(false);
    });

    it('rejects descriptions shorter than 20 characters', () => {
      const res = customOrderCreateSchema.safeParse({
        ...validPayload,
        description: 'Too short des.',
      });
      expect(res.success).toBe(false);
    });

    it('rejects invalid date formats for deadline', () => {
      const res = customOrderCreateSchema.safeParse({
        ...validPayload,
        deadline: '30-06-2026', // invalid, should be YYYY-MM-DD
      });
      expect(res.success).toBe(false);
    });
  });

  describe('creatorQuoteCustomOrderSchema', () => {
    it('successfully parses valid creator quotes', () => {
      const res = creatorQuoteCustomOrderSchema.safeParse({
        customOrderId: CUSTOM_ORDER_ID,
        creatorQuoteAmount: 6500,
        creatorQuoteNote: 'I can deliver it in 4 weeks. Walmart walnut wood is selected.',
      });
      expect(res.success).toBe(true);
    });

    it('rejects negative quote amounts', () => {
      const res = creatorQuoteCustomOrderSchema.safeParse({
        customOrderId: CUSTOM_ORDER_ID,
        creatorQuoteAmount: -500,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('customOrderStatusUpdateSchema', () => {
    it('successfully parses supported status update actions', () => {
      const res = customOrderStatusUpdateSchema.safeParse({
        customOrderId: CUSTOM_ORDER_ID,
        action: 'accept_quote',
      });
      expect(res.success).toBe(true);
    });

    it('rejects unsupported actions', () => {
      const res = customOrderStatusUpdateSchema.safeParse({
        customOrderId: CUSTOM_ORDER_ID,
        action: 'paid', // not in allowed enum list for manual action triggers
      });
      expect(res.success).toBe(false);
    });
  });
});
