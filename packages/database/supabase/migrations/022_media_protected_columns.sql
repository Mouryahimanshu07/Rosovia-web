-- packages/database/supabase/migrations/022_media_protected_columns.sql

-- Add columns if not present
ALTER TABLE public.media_assets
ADD COLUMN IF NOT EXISTS alt_text text null,
ADD COLUMN IF NOT EXISTS sort_order integer not null default 0;

-- Add constraints
ALTER TABLE public.media_assets
ADD CONSTRAINT media_assets_sort_order_check CHECK (sort_order >= 0),
ADD CONSTRAINT media_assets_alt_text_length_check CHECK (char_length(alt_text) <= 300);

-- Create a trigger function to block regular users from updating protected fields
CREATE OR REPLACE FUNCTION public.check_media_protected_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to authenticated users, bypass for service_role/postgres
  IF auth.role() = 'authenticated' THEN
    -- Check if user is an admin
    IF NOT public.is_admin() THEN
      -- Regular user check: Only allow updating alt_text and sort_order
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
         NEW.listing_id IS DISTINCT FROM OLD.listing_id OR
         NEW.storage_provider IS DISTINCT FROM OLD.storage_provider OR
         NEW.storage_key IS DISTINCT FROM OLD.storage_key OR
         NEW.public_url IS DISTINCT FROM OLD.public_url OR
         NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
         NEW.mime_type IS DISTINCT FROM OLD.mime_type OR
         NEW.is_private IS DISTINCT FROM OLD.is_private OR
         NEW.status IS DISTINCT FROM OLD.status OR
         NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        RAISE EXCEPTION 'You are not allowed to update protected media fields.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_media_protected_columns ON public.media_assets;
CREATE TRIGGER tr_check_media_protected_columns
BEFORE UPDATE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.check_media_protected_columns();
