-- =============================================================================
-- Rosovia Migration 070: Fix Messaging Bidirectional FK & Backfill Conversation Columns
-- =============================================================================
-- Problem:
--   Migration 043 added custom_orders.conversation_id → conversations (FK A).
--   Migration 065 added conversations.custom_order_id → custom_orders  (FK B).
--   These two opposite-direction FKs between the same tables cause PostgREST to
--   throw "Could not embed because more than one relationship was found for
--   'conversations' and 'custom_orders'" every time the inbox tries to load.
--
-- Additional problems found:
--   - conversations.buyer_profile_id was never populated by application code,
--     causing the maintain_conversation_participants trigger to silently skip
--     inserting the buyer into conversation_participants.
--   - conversations.seller_profile_id was never populated by application code,
--     causing the same trigger to skip inserting the seller participant.
--   - conversations.custom_order_id was added in migration 065 but never written
--     by the application; the canonical link lives on custom_orders.conversation_id.
--
-- Fixes applied here:
--   1. Rename conversations_custom_order_id_fkey → fk_conversations_custom_order_id
--      (explicit name lets PostgREST hint `!fk_conversations_custom_order_id` work
--      reliably should you ever want to embed again in future queries).
--   2. Backfill conversations.buyer_profile_id = conversations.buyer_id for all
--      existing rows (buyer_id IS the profile ID — same table, same value).
--   3. Backfill conversations.seller_profile_id from creator_profiles.user_id for
--      all existing rows.
--   4. Backfill conversations.custom_order_id from custom_orders.conversation_id
--      for all existing rows, so both FK directions are consistent.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Rename the FK constraint for clarity and reliable PostgREST hinting
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'conversations_custom_order_id_fkey'
      AND table_name = 'conversations'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.conversations
      RENAME CONSTRAINT conversations_custom_order_id_fkey TO fk_conversations_custom_order_id;
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. Backfill buyer_profile_id (= buyer_id — same value, different column)
-- ---------------------------------------------------------------------------
UPDATE public.conversations
SET buyer_profile_id = buyer_id
WHERE buyer_profile_id IS NULL;


-- ---------------------------------------------------------------------------
-- 3. Backfill seller_profile_id from creator_profiles.user_id
-- ---------------------------------------------------------------------------
UPDATE public.conversations c
SET seller_profile_id = cp.user_id
FROM public.creator_profiles cp
WHERE c.creator_id  = cp.id
  AND c.seller_profile_id IS NULL
  AND cp.deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 4. Backfill conversations.custom_order_id from custom_orders.conversation_id
--    (synchronise both directions of the bidirectional relationship)
-- ---------------------------------------------------------------------------
UPDATE public.conversations c
SET custom_order_id = co.id
FROM public.custom_orders co
WHERE co.conversation_id = c.id
  AND c.custom_order_id  IS NULL
  AND co.deleted_at       IS NULL;


-- ---------------------------------------------------------------------------
-- 5. Backfill any conversation_participants rows that are missing because
--    the trigger fired before buyer/seller_profile_id was set.
-- ---------------------------------------------------------------------------
INSERT INTO public.conversation_participants (conversation_id, profile_id, role, joined_at)
SELECT c.id, c.buyer_profile_id, 'buyer', c.created_at
FROM public.conversations c
WHERE c.buyer_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, profile_id, role, joined_at)
SELECT c.id, c.seller_profile_id, 'seller', c.created_at
FROM public.conversations c
WHERE c.seller_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- 6. Create indexes for the now-populated columns (idempotent)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS conversations_buyer_profile_id_idx
  ON public.conversations(buyer_profile_id);

CREATE INDEX IF NOT EXISTS conversations_seller_profile_id_idx
  ON public.conversations(seller_profile_id);
