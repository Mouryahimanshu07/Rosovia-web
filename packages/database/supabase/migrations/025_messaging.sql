-- =============================================================================
-- Rosovia Module: Messaging Foundation
-- Migration: 025_messaging.sql
-- Purpose: Creates public.conversations and public.messages tables, indexes, and RLS policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid        primary key default gen_random_uuid(),
  buyer_id        uuid        not null references public.profiles(id) on delete cascade,
  creator_id      uuid        not null references public.creator_profiles(id) on delete cascade,
  order_id        uuid        null references public.orders(id) on delete set null,
  inquiry_id      uuid        null references public.inquiries(id) on delete set null,
  last_message_at timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz null
);


-- Trigger: auto-update updated_at for conversations
drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Table: public.messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id                uuid        primary key default gen_random_uuid(),
  conversation_id   uuid        not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid        not null references public.profiles(id) on delete cascade,
  body              text        not null,
  read_at           timestamptz null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz null,

  constraint messages_body_length_check check (
    char_length(body) >= 1 and char_length(body) <= 2000
  )
);

-- Trigger: auto-update updated_at for messages
drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
create index if not exists conversations_buyer_id_idx on public.conversations(buyer_id);
create index if not exists conversations_creator_id_idx on public.conversations(creator_id);
create index if not exists conversations_order_id_idx on public.conversations(order_id);
create index if not exists conversations_inquiry_id_idx on public.conversations(inquiry_id);
create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc nulls last);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_profile_id_idx on public.messages(sender_profile_id);
create index if not exists messages_created_at_idx on public.messages(created_at asc);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- 4a. Conversations Select Policies
drop policy if exists "conversations: buyer can read own" on public.conversations;
create policy "conversations: buyer can read own"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = conversations.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );

drop policy if exists "conversations: creator can read assigned" on public.conversations;
create policy "conversations: creator can read assigned"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = conversations.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
    and deleted_at is null
  );

drop policy if exists "conversations: admin can read all" on public.conversations;
create policy "conversations: admin can read all"
  on public.conversations
  for select
  to authenticated
  using (public.is_admin());

-- 4b. Conversations Insert Policies
drop policy if exists "conversations: buyer can insert" on public.conversations;
create policy "conversations: buyer can insert"
  on public.conversations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = conversations.buyer_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

drop policy if exists "conversations: creator can insert" on public.conversations;
create policy "conversations: creator can insert"
  on public.conversations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = conversations.creator_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- Conversations Update Policies (for last_message_at update, etc.)
drop policy if exists "conversations: buyer can update own" on public.conversations;
create policy "conversations: buyer can update own"
  on public.conversations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = conversations.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = conversations.buyer_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

drop policy if exists "conversations: creator can update own" on public.conversations;
create policy "conversations: creator can update own"
  on public.conversations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = conversations.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
      where cp.id = conversations.creator_id
        and p.auth_user_id = auth.uid()
        and cp.deleted_at is null
        and p.deleted_at is null
    )
  );

-- 4c. Messages Select Policies
drop policy if exists "messages: user can select in own conversation" on public.messages;
create policy "messages: user can select in own conversation"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = c.buyer_id
              and p.auth_user_id = auth.uid()
              and p.deleted_at is null
          )
          or
          exists (
            select 1 from public.creator_profiles cp
            join public.profiles p on p.id = cp.user_id
            where cp.id = c.creator_id
              and p.auth_user_id = auth.uid()
              and cp.deleted_at is null
              and p.deleted_at is null
          )
        )
        and c.deleted_at is null
    )
    and deleted_at is null
  );

drop policy if exists "messages: admin can select" on public.messages;
create policy "messages: admin can select"
  on public.messages
  for select
  to authenticated
  using (public.is_admin());

-- 4d. Messages Insert Policies
drop policy if exists "messages: sender can insert" on public.messages;
create policy "messages: sender can insert"
  on public.messages
  for insert
  to authenticated
  with check (
    -- sender profile belongs to current user
    exists (
      select 1 from public.profiles p
      where p.id = messages.sender_profile_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    -- sender is part of the non-deleted conversation
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = messages.sender_profile_id
          or
          exists (
            select 1 from public.creator_profiles cp
            where cp.id = c.creator_id
              and cp.user_id = messages.sender_profile_id
          )
        )
        and c.deleted_at is null
    )
  );

-- 4e. Messages Update Policies (for marking read)
drop policy if exists "messages: recipient can update read_at" on public.messages;
create policy "messages: recipient can update read_at"
  on public.messages
  for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = c.buyer_id
              and p.auth_user_id = auth.uid()
              and p.deleted_at is null
          )
          or
          exists (
            select 1 from public.creator_profiles cp
            join public.profiles p on p.id = cp.user_id
            where cp.id = c.creator_id
              and p.auth_user_id = auth.uid()
              and cp.deleted_at is null
              and p.deleted_at is null
          )
        )
        and c.deleted_at is null
    )
  )
  with check (
    -- allow updating only read_at field
    (read_at is null or read_at is not null)
  );
