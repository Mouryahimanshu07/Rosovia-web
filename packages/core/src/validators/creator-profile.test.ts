import { describe, expect, it } from 'vitest';
import { creatorProfileCreateSchema, creatorProfileUpdateSchema } from './creator-profile';

describe('Creator Profile Validators', () => {
  const CATEGORY_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';

  describe('creatorProfileCreateSchema', () => {
    const validPayload = {
      displayName: 'Crafty John',
      bio: 'Professional woodworker specializing in walnut coffee tables.',
      story: 'Started in a small backyard shed, and now crafting for nationwide buyers.',
      primaryCategoryId: CATEGORY_ID,
      skills: ['woodworking', 'carpentry', 'finishing'],
      languages: ['English', 'Hindi'],
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      profileImageUrl: 'https://example.com/images/john.jpg',
      introVideoUrl: 'https://example.com/videos/john_intro.mp4',
    };

    it('successfully parses valid create payloads', () => {
      const res = creatorProfileCreateSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.displayName).toBe('Crafty John');
        expect(res.data.skills).toEqual(['woodworking', 'carpentry', 'finishing']);
      }
    });

    it('rejects display names shorter than 2 characters', () => {
      const res = creatorProfileCreateSchema.safeParse({
        ...validPayload,
        displayName: 'A',
      });
      expect(res.success).toBe(false);
    });

    it('rejects bio lengths exceeding 500 characters', () => {
      const res = creatorProfileCreateSchema.safeParse({
        ...validPayload,
        bio: 'a'.repeat(501),
      });
      expect(res.success).toBe(false);
    });

    it('rejects skills arrays exceeding 20 items', () => {
      const res = creatorProfileCreateSchema.safeParse({
        ...validPayload,
        skills: Array(21).fill('skill'),
      });
      expect(res.success).toBe(false);
    });

    it('rejects invalid URLs for profile image or intro video', () => {
      const imgRes = creatorProfileCreateSchema.safeParse({
        ...validPayload,
        profileImageUrl: 'not-a-valid-url',
      });
      expect(imgRes.success).toBe(false);

      const vidRes = creatorProfileCreateSchema.safeParse({
        ...validPayload,
        introVideoUrl: 'not-a-valid-url',
      });
      expect(vidRes.success).toBe(false);
    });
  });

  describe('creatorProfileUpdateSchema', () => {
    it('successfully parses partial updates', () => {
      const res = creatorProfileUpdateSchema.safeParse({
        displayName: 'Crafty John Updated',
        skills: ['woodworking', 'epoxy-casting'],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.displayName).toBe('Crafty John Updated');
        expect(res.data.skills).toEqual(['woodworking', 'epoxy-casting']);
      }
    });
  });
});
