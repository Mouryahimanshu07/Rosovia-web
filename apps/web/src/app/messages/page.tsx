import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  listCurrentUserConversations,
  listCurrentUserMessages,
  getConversationById,
  getOrCreateConversationForCurrentUser,
} from '@rosovia/api';
import type { Conversation, MessageWithSender } from '@rosovia/core';
import { MessagesClient } from './messages-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inbox — Rosovia',
};

interface MessagesPageProps {
  searchParams: {
    id?: string;
    role?: 'buyer' | 'creator';
    creator?: string;
    user?: string;
    listing?: string;
    order?: string;
    inquiry?: string;
  };
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Handle message user entry point (preferred route contract)
  if (searchParams.user) {
    try {
      if (searchParams.user === profile.id) {
        redirect('/messages?error=cannot_message_self');
      }

      // Check target profile
      const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('id, status, role')
        .eq('id', searchParams.user)
        .is('deleted_at', null)
        .single();

      if (!targetError && targetProfile && targetProfile.status === 'active') {
        let buyerId: string | null = null;
        let creatorId: string | null = null;

        if (targetProfile.role === 'creator') {
          const { data: targetCreator } = await supabase
            .from('creator_profiles')
            .select('id')
            .eq('user_id', targetProfile.id)
            .is('deleted_at', null)
            .single();

          if (targetCreator) {
            buyerId = profile.id;
            creatorId = targetCreator.id;
          }
        } else if (profile.role === 'creator') {
          const { data: myCreator } = await supabase
            .from('creator_profiles')
            .select('id')
            .eq('user_id', profile.id)
            .is('deleted_at', null)
            .single();

          if (myCreator) {
            buyerId = targetProfile.id;
            creatorId = myCreator.id;
          }
        }

        if (buyerId && creatorId) {
          // Check if conversation exists
          let query = supabase
            .from('conversations')
            .select('id')
            .eq('buyer_id', buyerId)
            .eq('creator_id', creatorId)
            .is('deleted_at', null);

          if (searchParams.order) {
            query = query.eq('order_id', searchParams.order);
          } else {
            query = query.is('order_id', null);
          }

          if (searchParams.inquiry) {
            query = query.eq('inquiry_id', searchParams.inquiry);
          } else {
            query = query.is('inquiry_id', null);
          }

          if (searchParams.listing) {
            query = query.eq('listing_id', searchParams.listing);
          } else {
            query = query.is('listing_id', null);
          }

          const { data: existing } = await query.maybeSingle();

          if (existing) {
            redirect(`/messages?id=${existing.id}${searchParams.role ? `&role=${searchParams.role}` : ''}`);
          } else {
            const { data: newConvo, error: createError } = await supabase
              .from('conversations')
              .insert({ 
                buyer_id: buyerId, 
                creator_id: creatorId,
                listing_id: searchParams.listing || null,
                order_id: searchParams.order || null,
                inquiry_id: searchParams.inquiry || null
              })
              .select('id')
              .single();

            if (!createError && newConvo) {
              redirect(`/messages?id=${newConvo.id}${searchParams.role ? `&role=${searchParams.role}` : ''}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to get/create conversation for user entry point:', err);
    }
  }

  // Handle message creator entry point
  if (searchParams.creator) {
    try {
      const convo = await getOrCreateConversationForCurrentUser(supabase, {
        creatorId: searchParams.creator,
        listingId: searchParams.listing || null,
        orderId: searchParams.order || null,
        inquiryId: searchParams.inquiry || null,
      });
      redirect(`/messages?id=${convo.id}${searchParams.role ? `&role=${searchParams.role}` : ''}`);
    } catch (err) {
      console.error('Failed to get/create conversation for creator entry point:', err);
    }
  }  // Determine active view role (default to profile's role, but allow creators to toggle to buyer inbox)
  const isCreatorView = profile.role === 'creator' && searchParams.role !== 'buyer';
  const currentRole = isCreatorView ? 'creator' : 'buyer';

  // 1. Fetch conversation list (all conversations for both buyer & creator roles)
  const conversations = await listCurrentUserConversations(supabase, null);

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
      activeConversation = null;
    }
  }

  return (
    <MessagesClient
      conversations={conversations}
      initialMessages={messages}
      profile={profile}
      activeId={activeId}
      currentRole={currentRole}
    />
  );
}
