import { z } from 'zod';

export const profileFormSchema = z.object({
  fullName: z.string().min(2, 'Display name must be at least 2 characters').max(80, 'Display name is too long'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username is too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional().nullable(),
  city: z.string().max(80, 'City name is too long').optional().nullable(),
  state: z.string().max(80, 'State name is too long').optional().nullable(),
  country: z.string().min(1, 'Country is required').optional().default('India'),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  coverImageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  skills: z.string().max(500, 'Skills list is too long').optional().nullable(),
  languages: z.string().max(300, 'Languages list is too long').optional().nullable(),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),

  // Creator-only fields (made optional so buyer validation passes)
  headline: z.string().max(100, 'Headline is too long').optional().nullable(),
  primaryCategoryId: z.string().uuid('Please select a valid category').optional().nullable(),
  story: z.string().max(2000, 'Story must be 2000 characters or less').optional().nullable(),
  introVideoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).nullable(),
  acceptsCustomOrders: z.boolean().optional(),
  customOrderDescription: z.string().max(1000, 'Description must be 1000 characters or less').optional().nullable(),
  customOrderStartingPrice: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nonnegative('Starting price must be 0 or more').nullable()
  ).optional().nullable(),
  customOrderDeliveryDays: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().int().positive('Delivery days must be a positive integer').nullable()
  ).optional().nullable(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(80),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  bio: z.string().max(500).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().default('India'),
  avatarUrl: z.string().url().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  skills: z.string().array().max(20).optional().nullable(),
  languages: z.string().array().max(10).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),

  // Creator-only fields
  headline: z.string().max(100).optional().nullable(),
  primaryCategoryId: z.string().uuid().optional().nullable(),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
