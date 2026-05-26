import { describe, expect, it } from 'vitest';
import { listingCreateSchema, listingUpdateSchema, listingStatusActionSchema } from './listing';

describe('Listing Validators', () => {
  const CATEGORY_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';
  const LISTING_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';

  describe('listingCreateSchema', () => {
    const validPayload = {
      categoryId: CATEGORY_ID,
      listingType: 'product' as const,
      title: 'Beautiful Ceramic Vase',
      description: 'Handcrafted with premium red clay.',
      price: 499.99,
      currency: 'INR',
      stock: 5,
      city: 'Delhi',
      state: 'Delhi',
      customOrderAvailable: true,
      deliveryAvailable: true,
      onlineAvailable: false,
      offlineAvailable: true,
      metadata: {
        deliveryDays: 5,
        material: 'Clay',
        revisionCount: 2,
      },
    };

    it('successfully parses valid create payloads', () => {
      const res = listingCreateSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.title).toBe('Beautiful Ceramic Vase');
        expect(res.data.price).toBe(499.99);
      }
    });

    it('rejects invalid category UUID formats', () => {
      const res = listingCreateSchema.safeParse({
        ...validPayload,
        categoryId: 'invalid-uuid-format',
      });
      expect(res.success).toBe(false);
    });

    it('rejects negative values for price and stock', () => {
      const priceRes = listingCreateSchema.safeParse({
        ...validPayload,
        price: -10,
      });
      expect(priceRes.success).toBe(false);

      const stockRes = listingCreateSchema.safeParse({
        ...validPayload,
        stock: -1,
      });
      expect(stockRes.success).toBe(false);
    });

    it('rejects titles shorter than 3 characters', () => {
      const res = listingCreateSchema.safeParse({
        ...validPayload,
        title: 'Hi',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('listingUpdateSchema', () => {
    it('successfully parses partial updates while enforcing categoryId requirement', () => {
      const res = listingUpdateSchema.safeParse({
        categoryId: CATEGORY_ID,
        title: 'New Listing Title',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.title).toBe('New Listing Title');
      }
    });

    it('rejects updates missing categoryId', () => {
      const res = listingUpdateSchema.safeParse({
        title: 'New Listing Title',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('listingStatusActionSchema', () => {
    it('successfully parses valid action submissions', () => {
      const res = listingStatusActionSchema.safeParse({
        listingId: LISTING_ID,
        action: 'submit_for_review',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid/unsupported action types', () => {
      const res = listingStatusActionSchema.safeParse({
        listingId: LISTING_ID,
        action: 'invalid_action_type',
      });
      expect(res.success).toBe(false);
    });
  });
});
