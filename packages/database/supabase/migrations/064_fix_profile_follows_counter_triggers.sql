-- Migration 064: Fix profile follows counter triggers
-- Purpose: Sync total_followers counter on creator_profiles when follows are added/deleted.
-- It also allows pg_trigger_depth() > 1 to bypass prevent_creator_profile_privilege_change.

CREATE OR REPLACE FUNCTION public.prevent_creator_profile_privilege_change()
RETURNS TRIGGER AS $$
DECLARE
  caller_profile_id uuid;
begin
  -- Service-role/server jobs do not have auth.uid(); allow them.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may update verification/rating fields through admin workflows.
  if public.is_admin() then
    return new;
  end if;

  -- Bypass checks if update is called from another trigger (e.g. followers sync trigger)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  select p.id into caller_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.deleted_at is null
  limit 1;

  -- If the row belongs to the current creator, protect server-controlled fields.
  if caller_profile_id is not null and old.user_id = caller_profile_id then
    if new.user_id is distinct from old.user_id then
      raise exception 'You cannot reassign a creator profile';
    end if;

    if new.is_verified is distinct from old.is_verified then
      raise exception 'You cannot change verification status directly';
    end if;

    if new.verification_level is distinct from old.verification_level then
      raise exception 'You cannot change verification level directly';
    end if;

    if new.rating_avg is distinct from old.rating_avg then
      raise exception 'You cannot change rating average directly';
    end if;

    if new.rating_count is distinct from old.rating_count then
      raise exception 'You cannot change rating count directly';
    end if;

    if new.total_orders is distinct from old.total_orders then
      raise exception 'You cannot change total_orders directly';
    end if;

    if new.total_followers is distinct from old.total_followers then
      raise exception 'You cannot change total_followers directly';
    end if;

    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'You cannot delete or restore your creator profile directly';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'You cannot change created_at';
    end if;
  end if;

  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Sync trigger function for profile_follows -> creator_profiles.total_followers
CREATE OR REPLACE FUNCTION public.sync_creator_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_profiles
    SET total_followers = total_followers + 1
    WHERE user_id = NEW.following_profile_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_profiles
    SET total_followers = GREATEST(0, total_followers - 1)
    WHERE user_id = OLD.following_profile_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_creator_followers_count ON public.profile_follows;
CREATE TRIGGER trg_sync_creator_followers_count
  AFTER INSERT OR DELETE ON public.profile_follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_creator_followers_count();
