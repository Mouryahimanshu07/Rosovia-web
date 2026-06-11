import { z } from 'zod';

/**
 * Form-layer schema — used by React Hook Form in the browser.
 * Skills and languages are comma-separated strings (split on submit).
 * Sensitive fields (verification, rating, counters) are intentionally excluded.
 */
export const creatorProfileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(80, 'Display name is too long'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  story: z.string().max(2000, 'Story must be 2000 characters or less').optional(),
  primaryCategoryId: z.string().uuid('Please select a valid category'),
  skills: z.string().max(500, 'Skills list is too long').optional(),
  languages: z.string().max(300, 'Languages list is too long').optional(),
  city: z.string().max(80, 'City name is too long').optional(),
  state: z.string().max(80, 'State name is too long').optional(),
  country: z.string().min(1, 'Country is required').optional(),
  profileImageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  coverImageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  headline: z.string().max(100, 'Headline is too long').optional(),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  profileTheme: z.string().max(30).optional(),
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

/**
 * Service-layer schema — what the API service functions receive.
 * Skills and languages are already parsed into string arrays.
 */
export const creatorProfileCreateSchema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(500).optional(),
  story: z.string().max(2000).optional(),
  primaryCategoryId: z.string().uuid().optional(),
  skills: z.string().array().max(20),
  languages: z.string().array().max(10),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().default('India'),
  profileImageUrl: z.string().url().optional(),
  introVideoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  headline: z.string().max(100).optional(),
  websiteUrl: z.string().url().optional(),
  profileTheme: z.string().max(30).optional(),
  acceptsCustomOrders: z.boolean().optional(),
  customOrderDescription: z.string().max(1000).optional().nullable(),
  customOrderStartingPrice: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nonnegative().nullable()
  ).optional().nullable(),
  customOrderDeliveryDays: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().int().positive().nullable()
  ).optional().nullable(),
});

export const creatorProfileUpdateSchema = creatorProfileCreateSchema.partial();

export type CreatorProfileFormInput = z.infer<typeof creatorProfileFormSchema>;
export type CreatorProfileCreateInput = z.infer<typeof creatorProfileCreateSchema>;
export type CreatorProfileUpdateInput = z.infer<typeof creatorProfileUpdateSchema>;
