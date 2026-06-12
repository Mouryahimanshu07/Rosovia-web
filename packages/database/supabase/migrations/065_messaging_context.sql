-- =============================================================================
-- Rosovia Module: Messaging Context & Participants Extension
-- Migration: 065_messaging_context.sql
-- Purpose: Adds metadata columns to conversations/messages and introduces
--          the conversation_participants table for archive/pin/mute states.
-- =============================================================================

-- 1. Alter public.conversations table with additive columns
alter table public.conversations add column if not exists conversation_type text default 'direct' check (conversation_type in ('direct', 'listing', 'inquiry', 'custom_order', 'support'));
alter table public.conversations add column if not exists buyer_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.conversations add column if not exists seller_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.conversations add column if not exists listing_id uuid references public.listings(id) on delete set null;
alter table public.conversations add column if not exists custom_order_id uuid references public.custom_orders(id) on delete set null;
alter table public.conversations add column if not exists archived_by uuid[] default '{}';
alter table public.conversations add column if not exists pinned_by uuid[] default '{}';
alter table public.conversations add column if not exists muted_by uuid[] default '{}';

-- Backfill conversations buyer_profile_id from buyer_id
update public.conversations set buyer_profile_id = buyer_id where buyer_profile_id is null;

-- Backfill conversations seller_profile_id from creator_id's user_id
update public.conversations c
set seller_profile_id = cp.user_id
from public.creator_profiles cp
where c.creator_id = cp.id and c.seller_profile_id is null;

-- 2. Create public.conversation_participants table
create table if not exists public.conversation_participants (
  conversation_id   uuid        not null references public.conversations(id) on delete cascade,
  profile_id        uuid        not null references public.profiles(id) on delete cascade,
  role              text        not null check (role in ('buyer', 'seller', 'participant')),
  last_read_at      timestamptz null,
  archived_at       timestamptz null,
  pinned_at         timestamptz null,
  muted_until       timestamptz null,
  joined_at         timestamptz not null default now(),

  primary key (conversation_id, profile_id)
);

-- Backfill conversation_participants from existing conversations
insert into public.conversation_participants (conversation_id, profile_id, role, joined_at)
select id, buyer_profile_id, 'buyer', created_at
from public.conversations
on conflict do nothing;

insert into public.conversation_participants (conversation_id, profile_id, role, joined_at)
select id, seller_profile_id, 'seller', created_at
from public.conversations
where seller_profile_id is not null
on conflict do nothing;

-- 3. Alter public.messages table
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists message_type text default 'text';
alter table public.messages add column if not exists edited_at timestamptz null;
alter table public.messages add column if not exists status text default 'sent';

-- 4. Create indexes for performance
create index if not exists conversation_participants_profile_id_idx on public.conversation_participants(profile_id);
create index if not exists conversations_buyer_profile_id_idx on public.conversations(buyer_profile_id);
create index if not exists conversations_seller_profile_id_idx on public.conversations(seller_profile_id);
create index if not exists conversations_custom_order_id_idx on public.conversations(custom_order_id);

-- 5. Enable RLS
alter table public.conversation_participants enable row level security;

-- 6. Add RLS Policies for conversation_participants
drop policy if exists "participants: select own" on public.conversation_participants;
create policy "participants: select own"
  on public.conversation_participants
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

drop policy if exists "participants: insert own" on public.conversation_participants;
create policy "participants: insert own"
  on public.conversation_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

drop policy if exists "participants: update own" on public.conversation_participants;
create policy "participants: update own"
  on public.conversation_participants
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Add extra RLS policies for conversations and messages that support participants table
drop policy if exists "conversations: select participant new" on public.conversations;
create policy "conversations: select participant new"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      join public.profiles p on p.id = cp.profile_id
      where cp.conversation_id = id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );

drop policy if exists "messages: select participant new" on public.messages;
create policy "messages: select participant new"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      join public.profiles p on p.id = cp.profile_id
      where cp.conversation_id = conversation_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );

drop policy if exists "messages: insert participant new" on public.messages;
create policy "messages: insert participant new"
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = messages.sender_profile_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.profile_id = messages.sender_profile_id
    )
  );

-- Trigger: auto-maintain conversation_participants on conversations insert
create or replace function public.maintain_conversation_participants()
returns trigger as $$
declare
  seller_user_id uuid;
begin
  -- Insert buyer
  insert into public.conversation_participants (conversation_id, profile_id, role)
  values (new.id, new.buyer_profile_id, 'buyer')
  on conflict do nothing;

  -- Insert seller
  insert into public.conversation_participants (conversation_id, profile_id, role)
  values (new.id, new.seller_profile_id, 'seller')
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists conversations_participants_trigger on public.conversations;
create trigger conversations_participants_trigger
  after insert on public.conversations
  for each row execute function public.maintain_conversation_participants();
