// packages/core/src/validators/saved-item.ts

import { z } from 'zod';

export const saveListingSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
});

export const saveCreatorSchema = z.object({
  creatorProfileId: z.string().uuid('Invalid creator profile ID'),
});

export type SaveListingInput = z.infer<typeof saveListingSchema>;
export type SaveCreatorInput = z.infer<typeof saveCreatorSchema>;
