-- =============================================================================
-- Rosovia Module: User Blocks & Messaging Hardening
-- Migration: 066_user_blocks_and_messaging_hardening.sql
-- Purpose: Adds user blocking, updates report target constraints to include 'message',
--          and hardens RLS policies for conversations and messages.
-- =============================================================================

-- 1. Create public.user_blocks table
create table if not exists public.user_blocks (
  blocker_id  uuid        not null references public.profiles(id) on delete cascade,
  blocked_id  uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint user_blocks_self_block_check check (blocker_id <> blocked_id)
);

-- Indexes for performance
create index if not exists user_blocks_blocker_id_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);

-- Enable RLS
alter table public.user_blocks enable row level security;

-- RLS Policies for user_blocks
drop policy if exists "user_blocks: select own" on public.user_blocks;
create policy "user_blocks: select own"
  on public.user_blocks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = blocker_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
    or
    exists (
      select 1 from public.profiles p
      where p.id = blocked_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

drop policy if exists "user_blocks: insert own" on public.user_blocks;
create policy "user_blocks: insert own"
  on public.user_blocks
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = blocker_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

drop policy if exists "user_blocks: delete own" on public.user_blocks;
create policy "user_blocks: delete own"
  on public.user_blocks
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = blocker_id
        and p.auth_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- 2. Update public.reports target_type constraint
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (
  target_type in ('creator', 'listing', 'review', 'inquiry', 'user', 'message')
);

-- 3. Trigger to automatically fill profile IDs on conversations
create or replace function public.conversations_fill_profile_ids()
returns trigger as $$
begin
  if new.buyer_profile_id is null then
    new.buyer_profile_id := new.buyer_id;
  end if;
  if new.seller_profile_id is null then
    select user_id into new.seller_profile_id
    from public.creator_profiles
    where id = new.creator_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists conversations_fill_profile_ids_trigger on public.conversations;
create trigger conversations_fill_profile_ids_trigger
  before insert on public.conversations
  for each row execute function public.conversations_fill_profile_ids();

-- 4. Block checking helper
create or replace function public.are_blocked(p_user1 uuid, p_user2 uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.user_blocks
    where (blocker_id = p_user1 and blocked_id = p_user2)
       or (blocker_id = p_user2 and blocked_id = p_user1)
  );
end;
$$ language plpgsql security definer;

-- 5. Harden Conversations RLS Insert Policies
drop policy if exists "conversations: buyer can insert" on public.conversations;
create policy "conversations: buyer can insert"
  on public.conversations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = conversations.buyer_profile_id
        and p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
    and not public.are_blocked(conversations.buyer_profile_id, conversations.seller_profile_id)
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
    and not public.are_blocked(conversations.buyer_profile_id, conversations.seller_profile_id)
  );

-- 6. Harden Messages RLS select policy to exclude reported messages (hidden from normal view)
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
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'message'
        and r.target_id = id
        and r.status = 'pending'
    )
  );

-- 7. Harden Messages RLS insert policy to respect blocks
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
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.profile_id <> messages.sender_profile_id
        and public.are_blocked(messages.sender_profile_id, cp.profile_id)
    )
  );
