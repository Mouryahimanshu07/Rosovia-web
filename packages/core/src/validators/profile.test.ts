import { describe, expect, it } from 'vitest';
import { profileFormSchema, profileUpdateSchema } from './profile';

describe('Universal Profile Validators', () => {
  describe('profileFormSchema', () => {
    const validBuyerPayload = {
      fullName: 'Buyer Alice',
      username: 'buyer_alice',
      bio: 'Just looking around for premium items.',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      avatarUrl: 'https://example.com/avatar.png',
      coverImageUrl: 'https://example.com/cover.png',
      languages: 'English, Hindi',
    };

    const validCreatorPayload = {
      ...validBuyerPayload,
      fullName: 'Creator Bob',
      username: 'creator-bob',
      headline: 'Professional Designer',
      primaryCategoryId: '90886ff0-bc78-4395-9ffb-fa419356cc5c',
      skills: 'Designing, Web Design, UI UX',
    };

    it('successfully parses valid buyer form inputs', () => {
      const res = profileFormSchema.safeParse(validBuyerPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.fullName).toBe('Buyer Alice');
        expect(res.data.username).toBe('buyer_alice');
      }
    });

    it('successfully parses valid creator form inputs with professional fields', () => {
      const res = profileFormSchema.safeParse(validCreatorPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.headline).toBe('Professional Designer');
        expect(res.data.primaryCategoryId).toBe('90886ff0-bc78-4395-9ffb-fa419356cc5c');
      }
    });

    it('rejects display names shorter than 2 characters', () => {
      const res = profileFormSchema.safeParse({
        ...validBuyerPayload,
        fullName: 'A',
      });
      expect(res.success).toBe(false);
    });

    it('rejects usernames containing spaces or special characters', () => {
      const res1 = profileFormSchema.safeParse({
        ...validBuyerPayload,
        username: 'alice smith',
      });
      expect(res1.success).toBe(false);

      const res2 = profileFormSchema.safeParse({
        ...validBuyerPayload,
        username: 'alice@smith',
      });
      expect(res2.success).toBe(false);
    });

    it('rejects bio lengths exceeding 500 characters', () => {
      const res = profileFormSchema.safeParse({
        ...validBuyerPayload,
        bio: 'x'.repeat(501),
      });
      expect(res.success).toBe(false);
    });
  });

  describe('profileUpdateSchema', () => {
    it('successfully parses valid profile updates', () => {
      const res = profileUpdateSchema.safeParse({
        fullName: 'Updated Name',
        username: 'updated_username',
        skills: ['woodworking'],
      });
      expect(res.success).toBe(true);
    });
  });
});
