create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  provider_order_id text null,
  provider_payment_id text null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'processed',
  error_message text null,
  created_at timestamptz not null default now(),

  constraint webhook_events_provider_check check (
    provider in ('razorpay')
  ),

  constraint webhook_events_status_check check (
    processing_status in ('processed', 'ignored', 'failed')
  ),

  constraint webhook_events_provider_event_unique unique (provider, event_id)
);

create index if not exists webhook_events_provider_order_id_idx
  on public.webhook_events(provider_order_id);

create index if not exists webhook_events_provider_payment_id_idx
  on public.webhook_events(provider_payment_id);

create index if not exists webhook_events_created_at_idx
  on public.webhook_events(created_at);