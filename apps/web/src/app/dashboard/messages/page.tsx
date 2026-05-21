import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  listCurrentUserConversations,
  listCurrentUserMessages,
  getConversationById,
} from '@rosovia/api';
import type { Conversation, MessageWithSender } from '@rosovia/core';
import { DashboardShell } from '@rosovia/ui';
import { MessageComposer } from './composer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inbox — Rosovia',
};

interface MessagesPageProps {
  searchParams: {
    id?: string;
    role?: 'buyer' | 'creator';
  };
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Determine active view role (default to profile's role, but allow creators to toggle to buyer inbox)
  const isCreatorView = profile.role === 'creator' && searchParams.role !== 'buyer';
  const currentRole = isCreatorView ? 'creator' : 'buyer';

  // 1. Fetch conversation list
  const conversations = await listCurrentUserConversations(supabase, isCreatorView);

  // 2. Resolve active conversation and messages if selected
  const activeId = searchParams.id;
  let activeConversation: Conversation | null = null;
  let messages: MessageWithSender[] = [];

  if (activeId) {
    try {
      activeConversation = await getConversationById(supabase, activeId);
      if (activeConversation) {
        messages = await listCurrentUserMessages(supabase, activeId);
      }
    } catch (err) {
      // Gracefully catch access violations or invalid UUIDs
      activeConversation = null;
    }
  }

  // Helper: Format relative timestamp
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <DashboardShell
      title="Messages"
      description="Connect and coordinate on custom orders, inquiries, and projects."
    >
      <div className="flex flex-col space-y-6">
        {/* Role switcher for users who are creators but also browse as buyers */}
        {profile.role === 'creator' && (
          <div className="flex border-b border-gray-200">
            <Link
              href="/dashboard/messages?role=creator"
              className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
                currentRole === 'creator'
                  ? 'border-gray-950 text-gray-950'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💼 Creator Inbox
            </Link>
            <Link
              href="/dashboard/messages?role=buyer"
              className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
                currentRole === 'buyer'
                  ? 'border-gray-950 text-gray-950'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🛍️ Buyer Inbox
            </Link>
          </div>
        )}

        <div className="grid h-[600px] grid-cols-12 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* LEFT PANEL: Conversation list */}
          <div className="col-span-12 md:col-span-4 flex flex-col border-r border-gray-200 bg-gray-50/50">
            <div className="border-b border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900">
                {currentRole === 'creator' ? 'Client Threads' : 'Creator Conversations'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-150">
              {conversations.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-gray-500">
                  <span className="text-2xl mb-1">💬</span>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Your active conversations will appear here.
                  </p>
                </div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeId;
                  const displayName =
                    currentRole === 'creator'
                      ? c.buyer_full_name || c.buyer_username || 'Buyer'
                      : c.creator_display_name || 'Creator';
                  const initials = displayName.charAt(0).toUpperCase();

                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/messages?id=${c.id}${
                        profile.role === 'creator' ? `&role=${currentRole}` : ''
                      }`}
                      className={`flex items-start gap-3 p-4 text-left transition hover:bg-gray-100/70 ${
                        isActive ? 'bg-gray-100' : ''
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-700 text-sm">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`truncate text-sm font-semibold ${c.unread_count > 0 ? 'text-gray-950 font-bold' : 'text-gray-700'}`}>
                            {displayName}
                          </h3>
                          {c.last_message_at && (
                            <span className="text-[10px] text-gray-400">
                              {formatTime(c.last_message_at)}
                            </span>
                          )}
                        </div>

                        <p className={`mt-1 truncate text-xs ${c.unread_count > 0 ? 'text-gray-950 font-medium' : 'text-gray-500'}`}>
                          {c.last_message_body || 'No messages yet'}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {c.order_id && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                              📦 Order Reference
                            </span>
                          )}
                          {c.inquiry_id && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                              💬 Inquiry
                            </span>
                          )}
                          {c.unread_count > 0 && (
                            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-950 px-1 text-[10px] font-bold text-white">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Chat Thread */}
          <div className="col-span-12 md:col-span-8 flex flex-col bg-white">
            {activeConversation ? (
              <>
                {/* Chat Top Bar */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {currentRole === 'creator'
                        ? (conversations.find((c) => c.id === activeId)?.buyer_full_name || 'Buyer')
                        : (conversations.find((c) => c.id === activeId)?.creator_display_name || 'Creator')}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      Conversation thread
                      {activeConversation.order_id && (
                        <span className="font-semibold text-indigo-600">(Discussing Order)</span>
                      )}
                      {activeConversation.inquiry_id && (
                        <span className="font-semibold text-emerald-600">(Discussing Inquiry)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Message bubbles */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                      <span className="text-3xl mb-1">✍️</span>
                      <p className="text-sm font-medium">Send a message to start conversation.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.sender_profile_id === profile.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                              isMe
                                ? 'bg-gray-950 text-white rounded-br-none'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                            }`}
                          >
                            <p className="leading-6 whitespace-pre-wrap">{m.body}</p>
                          </div>
                          <span className="mt-1 text-[10px] text-gray-400 px-1">
                            {formatTime(m.created_at)}
                            {isMe && m.read_at && (
                              <span className="ml-1 text-gray-500 font-medium">· Read</span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Composer input */}
                <MessageComposer conversationId={activeConversation.id} />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-gray-500">
                <span className="text-4xl mb-3">✉️</span>
                <p className="text-base font-semibold text-gray-900">Select a conversation</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm">
                  Choose a contact from the left list to see message history and coordinate order details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
