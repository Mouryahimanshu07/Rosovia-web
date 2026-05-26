// packages/core/src/validators/creator-collection.ts

import { z } from 'zod';

export const createCollectionSchema = z.object({
  name: z.string()
    .min(1, 'Name must be at least 1 character')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
});

export const updateCollectionSchema = z.object({
  name: z.string()
    .min(1, 'Name must be at least 1 character')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
});

export const addCollectionItemSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  sortOrder: z.number().int().optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;
