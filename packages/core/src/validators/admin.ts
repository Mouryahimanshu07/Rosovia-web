import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. User status update schema
// ---------------------------------------------------------------------------

export const adminUserStatusUpdateSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  action: z.enum(['suspend', 'reactivate'], {
    message: 'Action must be suspend or reactivate',
  }),
  note: z.string().max(1000, 'Note must be 1000 characters or fewer').optional(),
});

// ---------------------------------------------------------------------------
// 2. Listing moderation schema
// ---------------------------------------------------------------------------

export const adminListingModerationSchema = z.object({
  listingId: z.string().uuid('Listing ID must be a valid UUID'),
  action: z.enum(['approve', 'reject', 'suspend', 'archive'], {
    message: 'Action must be approve, reject, suspend, or archive',
  }),
  note: z.string().max(1000, 'Note must be 1000 characters or fewer').optional(),
});

// ---------------------------------------------------------------------------
// 3. Review moderation schema
// ---------------------------------------------------------------------------

export const adminReviewModerationSchema = z.object({
  reviewId: z.string().uuid('Review ID must be a valid UUID'),
  action: z.enum(['hide', 'unhide'], {
    message: 'Action must be hide or unhide',
  }),
  note: z.string().max(1000, 'Note must be 1000 characters or fewer').optional(),
});

// ---------------------------------------------------------------------------
// 4. Category create schema
// ---------------------------------------------------------------------------

export const adminCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
  type: z.enum(['product', 'service', 'learning', 'performance', 'mixed'], {
    message: 'Please select a valid category type',
  }),
  iconName: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// 5. Category update schema
// ---------------------------------------------------------------------------

export const adminCategoryUpdateSchema = z.object({
  categoryId: z.string().uuid('Category ID must be a valid UUID'),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['product', 'service', 'learning', 'performance', 'mixed']).optional(),
  iconName: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// 6. Admin list params schema
// ---------------------------------------------------------------------------

export const adminListParamsSchema = z.object({
  status: z.string().optional(),
  page: z.number().int().positive().default(1),
  q: z.string().max(100).optional(),
});

// ---------------------------------------------------------------------------
// 7. Category form schema (UI only — used by CategoryForm for both create and edit)
//    All fields are required at the form level so a single resolver can be used.
//    The server actions (createCategoryAction / updateCategoryAction) each apply
//    their own validated schemas (create / update) independently on the server.
// ---------------------------------------------------------------------------

export const adminCategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
  type: z.enum(['product', 'service', 'learning', 'performance', 'mixed'], {
    message: 'Please select a valid category type',
  }),
  iconName: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(999),
  isActive: z.boolean(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AdminUserStatusUpdateInput = z.infer<typeof adminUserStatusUpdateSchema>;
export type AdminListingModerationInput = z.infer<typeof adminListingModerationSchema>;
export type AdminReviewModerationInput = z.infer<typeof adminReviewModerationSchema>;
export type AdminCategoryCreateInput = z.infer<typeof adminCategoryCreateSchema>;
export type AdminCategoryUpdateInput = z.infer<typeof adminCategoryUpdateSchema>;
export type AdminListParamsInput = z.infer<typeof adminListParamsSchema>;
export type AdminCategoryFormInput = z.infer<typeof adminCategoryFormSchema>;
