alter table public.media_assets
  drop constraint if exists media_assets_status_check;

alter table public.media_assets
  add constraint media_assets_status_check check (
    status in (
      'uploaded',
      'processing',
      'pending_review',
      'approved',
      'rejected',
      'failed',
      'deleted'
    )
  );

drop policy if exists "media_assets: public can read public ready" on public.media_assets;

create policy "media_assets: public can read approved public media"
  on public.media_assets
  for select
  using (
    is_private = false
    and status = 'approved'
    and deleted_at is null
  );