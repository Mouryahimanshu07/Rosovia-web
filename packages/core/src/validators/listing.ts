import { z } from 'zod';

export const LISTING_TYPES = [
  'product',
  'service',
  'mentorship',
  'workshop',
  'event_booking',
  'portfolio',
] as const;

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'archived',
  'suspended',
] as const;

export const LISTING_STATUS_ACTIONS = [
  'submit_for_review',
  'archive',
  'restore_to_draft',
] as const;

/**
 * Form-layer schema — used by React Hook Form in the browser.
 * Price and stock are strings (HTML number inputs return strings via RHF).
 * Boolean flags are proper booleans.
 * Sensitive fields (status, verification_status, creator_id) are excluded.
 */
export const listingFormSchema = z.object({
  categoryId: z.string().uuid('Please select a category'),
  listingType: z.enum(LISTING_TYPES, { message: 'Please select a listing type' }),
  title: z.string().min(3, 'Title must be at least 3 characters').max(120, 'Title is too long'),
  description: z.string().max(3000, 'Description is too long').optional(),
  // Stored as strings from HTML input, parsed at submit
  price: z.string().optional(),
  currency: z.string().optional(),
  stock: z.string().optional(),
  city: z.string().max(80, 'City is too long').optional(),
  state: z.string().max(80, 'State is too long').optional(),
  customOrderAvailable: z.boolean(),
  deliveryAvailable: z.boolean(),
  onlineAvailable: z.boolean(),
  offlineAvailable: z.boolean(),
  // Metadata simple fields
  deliveryDays: z.string().optional(),
  material: z.string().max(100, 'Material is too long').optional(),
  techStack: z.string().max(200, 'Tech stack is too long').optional(),
  revisionCount: z.string().optional(),
  fileFormats: z.string().max(200, 'File formats is too long').optional(),
});

/**
 * Service-layer schema — validated in server actions.
 * Sensitive system fields are excluded and enforced in service layer.
 */
export const listingCreateSchema = z.object({
  categoryId: z.string().uuid(),
  listingType: z.enum(LISTING_TYPES),
  title: z.string().min(3).max(120),
  description: z.string().max(3000).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  customOrderAvailable: z.boolean(),
  deliveryAvailable: z.boolean(),
  onlineAvailable: z.boolean(),
  offlineAvailable: z.boolean(),
  metadata: z.object({
    deliveryDays: z.number().int().nonnegative().optional(),
    material: z.string().max(100).optional(),
    techStack: z.string().max(200).optional(),
    revisionCount: z.number().int().nonnegative().optional(),
    fileFormats: z.string().max(200).optional(),
  }).optional(),
});

export const listingUpdateSchema = listingCreateSchema.partial().extend({
  categoryId: z.string().uuid(),
});

export const listingStatusActionSchema = z.object({
  listingId: z.string().uuid(),
  action: z.enum(LISTING_STATUS_ACTIONS),
});

export type ListingFormInput = z.infer<typeof listingFormSchema>;
export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type ListingStatusActionInput = z.infer<typeof listingStatusActionSchema>;
