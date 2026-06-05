// packages/core/src/validators/follow.ts
// Zod validators for creator follows.

import { z } from 'zod';

export const followCreatorSchema = z.object({
  creatorProfileId: z.string().uuid('Creator profile ID must be a valid UUID'),
});

export const unfollowCreatorSchema = z.object({
  creatorProfileId: z.string().uuid('Creator profile ID must be a valid UUID'),
});

export type FollowCreatorSchemaInput = z.infer<typeof followCreatorSchema>;
export type UnfollowCreatorSchemaInput = z.infer<typeof unfollowCreatorSchema>;

export const followProfileSchema = z.object({
  followingProfileId: z.string().uuid('Profile ID must be a valid UUID'),
});

export const unfollowProfileSchema = z.object({
  followingProfileId: z.string().uuid('Profile ID must be a valid UUID'),
});

export type FollowProfileSchemaInput = z.infer<typeof followProfileSchema>;
export type UnfollowProfileSchemaInput = z.infer<typeof unfollowProfileSchema>;
