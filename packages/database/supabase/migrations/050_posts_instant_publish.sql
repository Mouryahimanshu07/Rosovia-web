-- Migration 050: Instant publish for creator posts
-- Purpose: Posts no longer require admin approval. New posts default to 'approved'
--          so they are immediately visible to the public. Listings still require admin
--          approval and are unaffected by this migration.

-- Change the column default from 'pending' to 'approved'
ALTER TABLE public.creator_posts
  ALTER COLUMN moderation_status SET DEFAULT 'approved';

-- Back-fill any existing 'pending' posts that were never acted on by admin.
-- These are posts that have been waiting for review but were never approved/rejected.
-- We promote them to 'approved' since the new policy is instant publish.
-- NOTE: This excludes posts that were explicitly 'rejected' or 'hidden' by admins
--       which should remain in their current state.
UPDATE public.creator_posts
SET moderation_status = 'approved'
WHERE moderation_status = 'pending'
  AND deleted_at IS NULL;
