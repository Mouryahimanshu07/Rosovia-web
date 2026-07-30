'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  MessageSquare, 
  Send, 
  Image as ImageIcon, 
  Smile, 
  MoreVertical, 
  ArrowLeft, 
  Archive, 
  Pin, 
  VolumeX, 
  Trash2, 
  ShoppingBag, 
  Tag, 
  User, 
  Loader2,
  X,
  Plus,
  ExternalLink,
  Check,
  CheckCheck,
  Flag,
  ShieldAlert,
  Mic,
  Calendar,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutList
} from 'lucide-react';

import type { ConversationWithDetails, MessageWithSender, Profile } from '@rosovia/core';
import { getSupabaseBrowserClient } from '~/lib/supabase/client';
import { 
  sendMessageAction, 
  archiveConversationAction, 
  pinConversationAction, 
  muteConversationAction,
  acceptAndCreateCustomOfferOrderAction,
  blockUserAction,
  reportMessageAction,
  markConversationMessagesAsReadAction
} from './actions';
import { CustomOfferForm } from './custom-offer-form';
import { AcceptOfferButton } from './accept-offer-button';

interface MessagesClientProps {
  conversations: ConversationWithDetails[];
  initialMessages: MessageWithSender[];
  profile: Profile;
  activeId?: string;
  currentRole: 'buyer' | 'creator';
}

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '🦾', '❤️', '🧡', '💛', '💚',
  '💙', '💜', '🖤', '🤍', '🤎', '💔', '🔥', '✨', '🎉', '💡'
];

export function MessagesClient({
  conversations: initialConversations,
  initialMessages,
  profile,
  activeId,
  currentRole,
}: MessagesClientProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [conversations, setConversations] = React.useState<ConversationWithDetails[]>(initialConversations);
  const [messages, setMessages] = React.useState<MessageWithSender[]>(initialMessages);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Buyer Inbox vs Seller Inbox Tab (Primary Grouping)
  const [activeInbox, setActiveInbox] = React.useState<'buying' | 'selling'>(
    profile.role === 'creator' && currentRole === 'creator' ? 'selling' : 'buying'
  );
  
  // Secondary Filters (All, Unread, Archived)
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'unread' | 'archived'>('all');
  
  const [body, setBody] = React.useState('');
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Realtime Presence & Status
  const [onlineUsers, setOnlineUsers] = React.useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = React.useState<Record<string, boolean>>({});
  
  // Attachments State
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  
  // Emoji Picker Popover State
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  
  // Mock Voice Recording UI State
  const [isRecordingVoice, setIsRecordingVoice] = React.useState(false);
  const [voiceSeconds, setVoiceSeconds] = React.useState(0);
  const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Audio Player State for Voice Note playback
  const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(null);

  // Panel Toggles
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  // Blocking and Moderation
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [hasBlockedMe, setHasBlockedMe] = React.useState(false);
  const [reportingMessage, setReportingMessage] = React.useState<MessageWithSender | null>(null);
  const [reportReason, setReportReason] = React.useState('spam');
  const [reportDesc, setReportDesc] = React.useState('');
  const [isReporting, setIsReporting] = React.useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = React.useState(false);

  // References
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);
  const lastMessageIdRef = React.useRef<string | null>(null);

  // Lock body overflow & hide footer on mount, restore on unmount
  React.useEffect(() => {
    document.documentElement.classList.add('messages-page-active');
    document.body.classList.add('messages-page-active');
    return () => {
      document.documentElement.classList.remove('messages-page-active');
      document.body.classList.remove('messages-page-active');
    };
  }, []);

  // Sync state if props change
  React.useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  React.useEffect(() => {
    const lastMsg = initialMessages[initialMessages.length - 1];
    const lastMsgId = lastMsg?.id ?? null;

    setMessages(initialMessages);

    if (lastMsgId !== lastMessageIdRef.current) {
      scrollToBottom('auto');
      lastMessageIdRef.current = lastMsgId;
    }
    
    // Mark messages as read on server when entering conversation
    if (activeId) {
      markConversationMessagesAsReadAction(activeId).catch((err) => {
        console.error('Failed to mark messages as read on load:', err);
      });
    }
  }, [initialMessages, activeId]);

  // Handle outside click to close emoji picker
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── SCROLL HELPER ─────────────────────────────────────────────────────────
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior
        });
      }, 50);
    }
  };

  // Active Convo helper properties
  const activeConvo = conversations.find((c) => c.id === activeId);
  const isBuyingActive = activeConvo?.buyer_id === profile.id;
  
  const counterPartyName = activeConvo 
    ? (isBuyingActive ? activeConvo.creator_display_name || 'Creator' : activeConvo.buyer_full_name || activeConvo.buyer_username || 'Buyer')
    : '';
  
  const counterPartyProfileId = activeConvo
    ? (isBuyingActive ? activeConvo.seller_profile_id : activeConvo.buyer_id)
    : '';

  const isCounterPartyOnline = counterPartyProfileId ? !!onlineUsers[counterPartyProfileId] : false;
  const isCounterPartyTyping = counterPartyProfileId ? !!typingUsers[counterPartyProfileId] : false;

  // ── FETCH BLOCK STATUS ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!counterPartyProfileId || !profile.id) {
      setIsBlocked(false);
      setHasBlockedMe(false);
      return;
    }
    
    // Check if I blocked them
    supabase
      .from('user_blocks')
      .select('*')
      .eq('blocker_id', profile.id)
      .eq('blocked_id', counterPartyProfileId)
      .maybeSingle()
      .then(({ data }) => {
        setIsBlocked(!!data);
      });

    // Check if they blocked me
    supabase
      .from('user_blocks')
      .select('*')
      .eq('blocker_id', counterPartyProfileId)
      .eq('blocked_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setHasBlockedMe(!!data);
      });
  }, [counterPartyProfileId, profile.id, supabase]);

  // ── REALTIME CONFIGURATION ────────────────────────────────────────────────
  React.useEffect(() => {
    // 1. Subscribe to Postgres Changes for ALL messages for current user (real-time message updates)
    let messagesSubscription: ReturnType<typeof supabase.channel> | null = null;
    if (activeId) {
      messagesSubscription = supabase
        .channel(`realtime:messages:${activeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeId}`,
          },
          async (payload: any) => {
          const { eventType, new: newMsg, old: oldMsg } = payload;

          if (eventType === 'INSERT') {
            // Fetch sender profile info dynamically to enrich the local state
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name, username, role')
              .eq('id', newMsg.sender_profile_id)
              .single();

            const enrichedMsg: MessageWithSender = {
              ...newMsg,
              sender_full_name: senderProfile?.full_name ?? 'User',
              sender_username: senderProfile?.username ?? 'user',
              sender_role: senderProfile?.role ?? 'buyer',
            };

            // Since the subscription is filtered by activeId, the message belongs to the currently active conversation
            setMessages((prev) => {
              if (prev.some((m) => m.id === enrichedMsg.id)) return prev;
              return [...prev, enrichedMsg];
            });
            scrollToBottom();

            // Mark as read on server if we have the conversation open and sender is not me
            if (newMsg.sender_profile_id !== profile.id && activeId) {
              markConversationMessagesAsReadAction(activeId!).catch((err) => {
                console.error('Failed to mark incoming message as read:', err);
              });
            }

            // Also update the sidebar conversation list: unread count, last message body, last message timestamp
            setConversations((prevConvos) => {
              return prevConvos.map((c) => {
                if (c.id === newMsg.conversation_id) {
                  const isNewMsgUnread = newMsg.sender_profile_id !== profile.id && newMsg.conversation_id !== activeId;
                  return {
                    ...c,
                    last_message_body: newMsg.body || (newMsg.attachment_url ? 'Sent an attachment' : 'New message'),
                    last_message_sender_id: newMsg.sender_profile_id,
                    last_message_at: newMsg.created_at,
                    unread_count: isNewMsgUnread ? c.unread_count + 1 : c.unread_count,
                  };
                }
                return c;
              }).sort((a, b) => {
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return timeB - timeA;
              });
            });
          }

          if (eventType === 'UPDATE') {
            // Message read receipt update (e.g. read_at value modified)
            setMessages((prev) => {
              return prev.map((m) => (m.id === newMsg.id ? { ...m, read_at: newMsg.read_at } : m));
            });

            // Update unread count and read_at states in conversation list
            setConversations((prevConvos) => {
              return prevConvos.map((c) => {
                if (c.id === newMsg.conversation_id) {
                  return {
                    ...c,
                    unread_count: newMsg.sender_profile_id !== profile.id && newMsg.read_at === null ? c.unread_count : 0,
                  };
                }
                return c;
              });
            });
          }
        }
      )
      .subscribe();
    }

    // 2. Subscribe to Postgres Changes for conversations table (pin/archive changes)
    const conversationsSubscription = supabase
      .channel('realtime:user_conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        async (payload: any) => {
          const { eventType, new: newConvo } = payload;
          if (eventType === 'UPDATE') {
            // Conversation metadata updated (e.g. last_message_at changed from a new message)
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === newConvo.id) {
                  return {
                    ...c,
                    last_message_at: newConvo.last_message_at,
                  };
                }
                return c;
              }).sort((a, b) => {
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return timeB - timeA;
              })
            );
          }
          if (eventType === 'INSERT') {
            // New conversation started. Fetch details and append to sidebar list.
            // FIX: Do NOT embed custom_orders in this SELECT — migrations 043 and 065
            // created two FK paths between conversations ↔ custom_orders in opposite
            // directions, making PostgREST throw "Could not embed because more than one
            // relationship was found". Fetch custom order data via a separate query
            // using the canonical custom_orders.conversation_id FK instead.
            const { data: enriched } = await supabase
              .from('conversations')
              .select('*, profiles!conversations_buyer_id_fkey ( full_name, username ), creator_profiles ( display_name, slug, user_id, primary_category_id ), listings ( title, category_id )')
              .eq('id', newConvo.id)
              .single();

            if (enriched) {
              // Fetch custom order separately via custom_orders.conversation_id to
              // avoid the bidirectional FK ambiguity on the conversations table.
              const { data: customOrder } = await supabase
                .from('custom_orders')
                .select('status, creator_quote_amount')
                .eq('conversation_id', newConvo.id)
                .is('deleted_at', null)
                .maybeSingle();

              const enrichedConvo: ConversationWithDetails = {
                ...enriched,
                buyer_full_name: enriched.profiles?.full_name ?? null,
                buyer_username: enriched.profiles?.username ?? null,
                creator_display_name: enriched.creator_profiles?.display_name ?? null,
                creator_slug: enriched.creator_profiles?.slug ?? null,
                creator_primary_category_id: enriched.creator_profiles?.primary_category_id ?? null,
                listing_category_id: enriched.listings?.category_id ?? null,
                seller_profile_id: enriched.seller_profile_id ?? enriched.creator_profiles?.user_id ?? null,
                last_message_body: null,
                last_message_sender_id: null,
                unread_count: 0,
                is_archived: false,
                is_pinned: false,
                muted_until: null,
                last_read_at: null,
                role_in_conversation: enriched.buyer_id === profile.id ? 'buyer' : 'seller',
                listing_title: enriched.listings?.title ?? null,
                listing_image_url: null,
                // Custom order data from the separate query
                custom_order_status: customOrder?.status ?? null,
                custom_order_price: customOrder?.creator_quote_amount ?? null,
              };

              setConversations((prev) => {
                if (prev.some((c) => c.id === enrichedConvo.id)) return prev;
                return [enrichedConvo, ...prev];
              });
            }
          }
        }
      )
      .subscribe();

    // 3. Subscribe to typing updates using Broadcast Channel
    const typingChannelName = activeId ? `typing:${activeId}` : 'typing:idle';
    const typingChannel = supabase
      .channel(typingChannelName)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const { senderId, isTyping } = payload.payload;
        if (senderId !== profile.id) {
          setTypingUsers((prev) => ({ ...prev, [senderId]: isTyping }));
        }
      })
      .subscribe();

    return () => {
      if (messagesSubscription) supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(conversationsSubscription);
      supabase.removeChannel(typingChannel);
    };
  }, [activeId, profile.id, supabase]);

  // Presence channel to track online statuses
  React.useEffect(() => {
    const presenceChannel = supabase.channel('online-presence', {
      config: { presence: { key: profile.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online: Record<string, boolean> = {};
        Object.keys(state).forEach((key) => {
          online[key] = true;
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [profile.id, supabase]);

  // ── TYPING EVENT TRIGGER ──────────────────────────────────────────────────
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    
    // Broadcast typing status
    if (activeId) {
      // Send typing status as true
      supabase.channel(`typing:${activeId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: profile.id, isTyping: e.target.value.length > 0 }
      });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Automatically set typing status to false after 3 seconds of silence
      typingTimeoutRef.current = setTimeout(() => {
        supabase.channel(`typing:${activeId}`).send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderId: profile.id, isTyping: false }
        });
      }, 3000);
    }
  };

  // ── ATTACHMENT HANDLER ────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10 MB limit.');
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Only image attachments are allowed at this time.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── EMOJI PICKER SELECTION ────────────────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    setBody((prev) => prev + emoji);
    if (composerTextareaRef.current) {
      composerTextareaRef.current.focus();
    }
  };

  // ── MOCK VOICE RECORDING CONTROLS ──────────────────────────────────────────
  const startVoiceRecording = () => {
    setIsRecordingVoice(true);
    setVoiceSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setVoiceSeconds((prev) => prev + 1);
    }, 1000);
  };

  const cancelVoiceRecording = () => {
    setIsRecordingVoice(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setVoiceSeconds(0);
  };

  const submitVoiceRecording = async () => {
    if (isBlocked || hasBlockedMe || !activeId) return;
    setIsPending(true);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    const minutes = Math.floor(voiceSeconds / 60);
    const remainingSeconds = voiceSeconds % 60;
    const durationStr = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    const bodyText = `🎤 Voice note (${durationStr})`;

    try {
      const result = await sendMessageAction(activeId!, bodyText, null);
      if (result.success) {
        setIsRecordingVoice(false);
        setVoiceSeconds(0);

        // Optimistically insert voice note
        const messageId = crypto.randomUUID();
        const optimisticMsg: MessageWithSender = {
          id: messageId,
          conversation_id: activeId!,
          sender_profile_id: profile.id,
          body: bodyText,
          attachment_url: null,
          message_type: 'voice',
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          sender_full_name: profile.full_name,
          sender_username: profile.username ?? 'me',
          sender_role: profile.role,
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send voice note');
    } finally {
      setIsPending(false);
    }
  };

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!body.trim() && !selectedFile) || isPending) return;
    if (isBlocked || hasBlockedMe) {
      setError('You cannot send messages due to active user blocks.');
      return;
    }

    setIsPending(true);
    setError(null);
    let attachmentUrl = null;
    const messageId = crypto.randomUUID(); // Pre-generate UUID for path matching

    try {
      // Step 1: Upload attachment if selected
      if (selectedFile) {
        setIsUploading(true);
        const fileType = 'image';
        
        // Fetch S3 signed URL
        const signRes = await fetch('/api/media/signed-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedFile.name,
            mimeType: selectedFile.type,
            sizeBytes: selectedFile.size,
            mediaType: fileType,
            usage: 'message_attachment',
            conversationId: activeId!,
            messageId: messageId,
          }),
        });

        if (!signRes.ok) {
          const errData = await signRes.json();
          throw new Error(errData.error || 'Failed to fetch upload URL');
        }
        const { signedUrl, storageKey, publicUrl } = await signRes.json();

        // Direct upload to Cloudflare R2
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type }
        });

        if (!uploadRes.ok) throw new Error('Failed to upload file to storage.');

        // Save metadata completion
        const completeRes = await fetch('/api/media/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaType: fileType,
            storageKey,
            sizeBytes: selectedFile.size,
            mimeType: selectedFile.type,
            usage: 'message_attachment',
            conversationId: activeId!,
            messageId: messageId,
          }),
        });

        if (!completeRes.ok) throw new Error('Metadata complete registration failed');
        const { media } = await completeRes.json();
        attachmentUrl = media.public_url;
      }

      // Step 2: Dispatch message server action
      const result = await sendMessageAction(activeId!, body.trim(), attachmentUrl);
      
      if (result.success) {
        setBody('');
        clearAttachment();
        
        // Broadcast typing stopped
        supabase.channel(`typing:${activeId}`).send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderId: profile.id, isTyping: false }
        });

        // Locally insert the message instantly to feel snappier
        const optimisticMsg: MessageWithSender = {
          id: messageId,
          conversation_id: activeId!,
          sender_profile_id: profile.id,
          body: body.trim(),
          attachment_url: attachmentUrl,
          message_type: attachmentUrl ? 'image' : 'text',
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          sender_full_name: profile.full_name,
          sender_username: profile.username ?? 'me',
          sender_role: profile.role,
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsPending(false);
      setIsUploading(false);
    }
  };

  // ── QUICK ACTIONS ─────────────────────────────────────────────────────────
  const handleArchive = async () => {
    if (!activeId) return;
    const activeConvo = conversations.find(c => c.id === activeId);
    const currentlyArchived = activeConvo?.is_archived ?? false;
    await archiveConversationAction(activeId, !currentlyArchived);
    setShowMoreMenu(false);
    router.refresh();
  };

  const handlePin = async () => {
    if (!activeId) return;
    const activeConvo = conversations.find(c => c.id === activeId);
    const currentlyPinned = activeConvo?.is_pinned ?? false;
    await pinConversationAction(activeId, !currentlyPinned);
    setShowMoreMenu(false);
    router.refresh();
  };

  const handleMute = async () => {
    if (!activeId) return;
    const activeConvo = conversations.find(c => c.id === activeId);
    const isMuted = activeConvo?.muted_until && new Date(activeConvo.muted_until) > new Date();
    
    const muteUntil = isMuted ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await muteConversationAction(activeId, muteUntil);
    setShowMoreMenu(false);
    router.refresh();
  };

  // ── BLOCK & REPORT TRIGGERS ───────────────────────────────────────────────
  const handleToggleBlock = async () => {
    if (!counterPartyProfileId) return;
    const res = await blockUserAction(counterPartyProfileId, !isBlocked);
    if (res.success) {
      setIsBlocked(!isBlocked);
    } else {
      setError(res.error);
    }
    setShowMoreMenu(false);
  };

  const handleReportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMessage) return;

    setIsReporting(true);
    const res = await reportMessageAction(reportingMessage.id, reportReason, reportDesc);
    if (res.success) {
      // Remove message from local view
      setMessages((prev) => prev.filter((m) => m.id !== reportingMessage.id));
      setReportingMessage(null);
      setReportDesc('');
    } else {
      setError(res.error);
    }
    setIsReporting(false);
  };

  // ── FILTER TABS & SEARCH ──────────────────────────────────────────────────
  const activeConversationsFilteredByInbox = conversations.filter((c) => {
    const isBuying = c.buyer_id === profile.id;
    const isSelling = c.buyer_id !== profile.id;
    
    // Tab Segmenting
    if (activeInbox === 'buying') return isBuying;
    if (activeInbox === 'selling') return isSelling;
    return true;
  });

  const finalFilteredConversations = activeConversationsFilteredByInbox.filter((c) => {
    const isBuying = c.buyer_id === profile.id;
    const displayName = isBuying 
      ? c.creator_display_name || 'Creator' 
      : c.buyer_full_name || c.buyer_username || 'Buyer';

    // Search query matching
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.last_message_body && c.last_message_body.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Secondary Filters
    if (activeFilter === 'unread') return c.unread_count > 0;
    if (activeFilter === 'archived') return c.is_archived;
    
    // By default ('all'), do not show archived conversations
    return !c.is_archived;
  });

  const pinnedConversations = finalFilteredConversations.filter((c) => c.is_pinned);
  const unpinnedConversations = finalFilteredConversations.filter((c) => !c.is_pinned);

  // Badge Counts for Tab Headers
  const unreadBuyingCount = conversations.filter(
    (c) => c.buyer_id === profile.id && c.unread_count > 0 && !c.is_archived
  ).length;

  const unreadSellingCount = conversations.filter(
    (c) => c.buyer_id !== profile.id && c.unread_count > 0 && !c.is_archived
  ).length;

  // ── DATE SEPARATOR FORMATTER ──────────────────────────────────────────────
  const formatDividerDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="grid grid-cols-12 w-full h-[calc(100dvh-3.5rem)] bg-white overflow-hidden text-slate-900 antialiased relative">
      
      {/* ── PANEL 1: CONVERSATION LIST (LEFT PANEL) ─────────────────────────── */}
      <div className={`col-span-12 md:col-span-4 h-full min-h-0 flex flex-col border-r border-slate-200 bg-slate-50/30 relative z-10 ${activeId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Inbox Switcher Tabs (Buyer vs Creator) */}
        {profile.role === 'creator' ? (
          <div className="grid grid-cols-2 p-2 bg-slate-100/50 border-b border-slate-200 shrink-0">
            <button
              onClick={() => {
                setActiveInbox('buying');
                setActiveFilter('all');
              }}
              className={`py-2 text-xs font-black rounded-xl transition duration-200 flex items-center justify-center gap-2 ${
                activeInbox === 'buying'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Buyer Inbox</span>
              {unreadBuyingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white">
                  {unreadBuyingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveInbox('selling');
                setActiveFilter('all');
              }}
              className={`py-2 text-xs font-black rounded-xl transition duration-200 flex items-center justify-center gap-2 ${
                activeInbox === 'selling'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Creator Inbox</span>
              {unreadSellingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white">
                  {unreadSellingCount}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="px-4 pt-3 pb-1 border-b border-slate-150 shrink-0">
            <h2 className="text-sm font-extrabold text-indigo-600">Messages Inbox</h2>
          </div>
        )}

        {/* Search & Sub-filters */}
        <div className="p-3.5 space-y-3 shrink-0 border-b border-slate-200/80 bg-white/40">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search chats or messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition duration-150 shadow-inner"
            />
          </div>

          {/* Subfilters */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {([
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'archived', label: 'Archived' }
            ] as const).map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-150 whitespace-nowrap ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-805 hover:bg-slate-200/60'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List scroll wrapper */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {finalFilteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-64 space-y-2">
              <span className="text-3xl">💬</span>
              <p className="text-xs font-bold text-slate-400">No conversations found</p>
              <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                Start connecting with buyers or creators from the explore pages.
              </p>
            </div>
          ) : (
            <>
              {/* PINNED SECTION */}
              {pinnedConversations.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 text-[9px] font-bold text-slate-450 tracking-wider uppercase">
                    <Pin className="h-3 w-3 text-slate-450 fill-current rotate-[45deg]" />
                    <span>Pinned Chats</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pinnedConversations.map((c) => renderConvoItem(c))}
                  </div>
                </div>
              )}

              {/* RECENT SECTION */}
              {unpinnedConversations.length > 0 && (
                <div>
                  {pinnedConversations.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-455 tracking-wider uppercase">
                      <span>Recent Chats</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {unpinnedConversations.map((c) => renderConvoItem(c))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── PANEL 2: ACTIVE CHAT WINDOW (MIDDLE PANEL) ──────────────────────── */}
      <div className={`col-span-12 md:col-span-8 h-full min-h-0 flex flex-col bg-slate-50 relative ${activeId ? 'flex' : 'hidden md:flex'}`}>
        {activeConvo ? (
          <>
            {/* Top Bar Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-white/95 backdrop-blur-md relative z-20 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button on mobile */}
                <Link
                  href={`/messages?role=${activeInbox}`}
                  className="p-1.5 text-slate-455 hover:text-slate-900 rounded-lg hover:bg-slate-100 md:hidden transition"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                
                {/* Peer user details */}
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {isBuyingActive ? (
                      activeConvo.creator_slug ? (
                        <Link
                          href={`/creators/${activeConvo.creator_slug}`}
                          target="_blank"
                          className="truncate hover:underline hover:text-indigo-600 transition"
                        >
                          {counterPartyName}
                        </Link>
                      ) : (
                        <span className="truncate">{counterPartyName}</span>
                      )
                    ) : (
                      activeConvo.buyer_username ? (
                        <Link
                          href={`/u/${activeConvo.buyer_username}`}
                          target="_blank"
                          className="truncate hover:underline hover:text-indigo-600 transition"
                        >
                          {counterPartyName}
                        </Link>
                      ) : (
                        <span className="truncate">{counterPartyName}</span>
                      )
                    )}
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[8px] font-bold text-slate-500 tracking-wide uppercase shrink-0">
                      {isBuyingActive ? 'Creator' : 'Client'}
                    </span>
                  </h3>
                  
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    {isCounterPartyTyping ? (
                      <span className="text-emerald-600 font-bold italic animate-pulse flex items-center gap-1">
                        typing
                        <span className="inline-flex gap-0.5">
                          <span className="h-1 w-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-1 w-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-1 w-1 bg-emerald-600 rounded-full animate-bounce" />
                        </span>
                      </span>
                    ) : (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${isCounterPartyOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="font-semibold">{isCounterPartyOnline ? 'Online' : 'Offline'}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat action controls */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 text-slate-400 hover:text-slate-800 transition rounded-xl hover:bg-slate-100 border border-transparent"
                  >
                    <MoreVertical className="h-4.5 w-4.5" />
                  </button>

                  {/* Dropdown Options */}
                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-scaleUp">
                      <button
                        onClick={handlePin}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-bold text-slate-650 hover:bg-slate-50 rounded-lg transition"
                      >
                        <Pin className="h-4 w-4 text-indigo-500" />
                        <span>{activeConvo.is_pinned ? 'Unpin conversation' : 'Pin conversation'}</span>
                      </button>
                      <button
                        onClick={handleArchive}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-bold text-slate-650 hover:bg-slate-50 rounded-lg transition"
                      >
                        <Archive className="h-4 w-4 text-emerald-500" />
                        <span>{activeConvo.is_archived ? 'Move to inbox' : 'Archive conversation'}</span>
                      </button>
                      <button
                        onClick={handleMute}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-bold text-slate-655 hover:bg-slate-50 rounded-lg transition"
                      >
                        <VolumeX className="h-4 w-4 text-blue-550" />
                        <span>
                          {activeConvo.muted_until && new Date(activeConvo.muted_until) > new Date()
                            ? 'Unmute alerts'
                            : 'Mute alerts (8h)'}
                        </span>
                      </button>
                      
                      <div className="h-px bg-slate-100 my-1" />
                      
                      {/* Block/Unblock Option */}
                      <button
                        onClick={handleToggleBlock}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-bold text-red-650 hover:bg-red-50 rounded-lg transition"
                      >
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        <span>{isBlocked ? 'Unblock user' : 'Block user'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email mirror notice banner */}
            <div className="bg-indigo-50/80 border-b border-indigo-100 px-6 py-2.5 text-[10px] text-indigo-750 flex items-center gap-2 font-bold backdrop-blur-sm shrink-0">
              <span>📨</span>
              <span>
                To optimize deliverability, replies are automatically mirrored to the counterparty&apos;s email address.
              </span>
            </div>

            {/* Middle Message Flow Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <span className="text-3xl">✍️</span>
                  <p className="text-xs font-bold text-slate-400">Discuss requirements & specs</p>
                  <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                    Send a message to start negotiating prices, custom order deadlines, or listings detail.
                  </p>
                </div>
              ) : (
                (() => {
                  let lastMsgDateStr = '';
                  return messages.map((m, index) => {
                    const isMe = m.sender_profile_id === profile.id;
                    const msgDate = new Date(m.created_at);
                    const showDateSeparator = msgDate.toDateString() !== lastMsgDateStr;
                    lastMsgDateStr = msgDate.toDateString();

                    // Render Custom Proposals
                    let offer = null;
                    if (m.body && m.body.startsWith('[CUSTOM_OFFER]:')) {
                      try {
                        offer = JSON.parse(m.body.substring('[CUSTOM_OFFER]:'.length));
                      } catch (e) {}
                    }

                    const relativeTime = msgDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                    // Consecutive messages spacing logic
                    const nextMsg = messages[index + 1];
                    const isConsecutive = nextMsg && nextMsg.sender_profile_id === m.sender_profile_id;

                    return (
                      <React.Fragment key={m.id}>
                        {/* Date Divider */}
                        {showDateSeparator && (
                          <div className="flex justify-center my-4 relative shrink-0">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                              <div className="w-full border-t border-slate-200/50" />
                            </div>
                            <span className="relative px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300/30 text-[9px] font-black text-slate-550 uppercase tracking-widest backdrop-blur-sm">
                              {formatDividerDate(m.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Proposal Card Bubble */}
                        {offer ? (
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full mb-3.5`}>
                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-3xl p-5 shadow-lg border backdrop-blur-sm transition-all duration-300 hover:shadow-xl ${
                              isMe
                                ? 'bg-indigo-50/90 text-slate-800 border-indigo-200/60 rounded-tr-none'
                                : 'bg-white text-slate-800 border-slate-200 rounded-tl-none shadow-md'
                            }`}>
                              <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-200/60">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                                  ⚡ Commission proposal
                                </span>
                                <span className="rounded-lg bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[9px] font-bold text-indigo-700">
                                  Quoted
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-450">Proposed Quote</span>
                                  <span className="text-xl font-black text-emerald-600 mt-1 block">₹{offer.price.toLocaleString('en-IN')}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-450">Delivery timeframe</span>
                                  <span className="text-xs font-bold text-indigo-600 mt-1 block">🕒 {offer.deliveryDays} Days</span>
                                </div>
                              </div>

                              {offer.note && (
                                <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                                  {offer.note}
                                </p>
                              )}

                              <div className="mt-5">
                                {!isMe ? (
                                  <AcceptOfferButton customOrderId={offer.customOrderId} />
                                ) : (
                                  <div className="text-[9px] text-indigo-700 font-bold italic text-center bg-indigo-100/50 py-2 rounded-lg border border-indigo-150/40">
                                    ✓ Proposal submitted. Waiting for buyer decision.
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="mt-1 text-[8px] text-slate-400 px-1.5 font-bold">{relativeTime}</span>
                          </div>
                        ) : (
                          /* Standard Message Bubble */
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isConsecutive ? 'mb-1' : 'mb-3.5'} group relative`}>
                            <div className="flex items-center gap-2 max-w-[75%]">
                              {/* Bubble element */}
                              <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words border shadow-sm ${
                                isMe
                                  ? 'bg-indigo-600 text-white rounded-tr-none border-indigo-700/30'
                                  : 'bg-white text-slate-800 rounded-tl-none border-slate-200 shadow-sm'
                              }`}>
                                {/* Image Attachment rendering */}
                                {m.attachment_url && (
                                  <div className="relative w-56 h-36 rounded-xl overflow-hidden mb-2 bg-slate-100 border border-slate-250/50 shadow-inner group/img">
                                    <Image src={m.attachment_url} alt="Attachment" fill unoptimized className="object-cover transition duration-300 hover:scale-105" />
                                    <a
                                      href={m.attachment_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition duration-200"
                                    >
                                      Open Image ↗
                                    </a>
                                  </div>
                                )}

                                {/* Voice Note Custom Audio Player interface */}
                                {m.message_type === 'voice' || (m.body && m.body.startsWith('🎤 Voice note')) ? (
                                  <div className="flex items-center gap-3.5 py-1 min-w-[200px]">
                                    <button
                                      type="button"
                                      onClick={() => setPlayingAudioId(playingAudioId === m.id ? null : m.id)}
                                      className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                                        isMe 
                                          ? 'bg-white/20 text-white hover:bg-white/30' 
                                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                      }`}
                                    >
                                      {playingAudioId === m.id ? (
                                        <Pause className="h-3.5 w-3.5 fill-current" />
                                      ) : (
                                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      {/* Waveform layout simulation */}
                                      <div className="flex gap-0.5 items-center h-4">
                                        {[3, 5, 2, 6, 8, 4, 7, 3, 5, 2, 6, 4, 8, 5, 7, 3, 4, 6, 2, 5, 8, 4, 6, 3].map((h, i) => (
                                          <div
                                            key={i}
                                            style={{ height: `${h * 2}px` }}
                                            className={`w-[2px] rounded-full transition-all duration-300 ${
                                              playingAudioId === m.id
                                                ? 'animate-pulse bg-indigo-400'
                                                : isMe ? 'bg-white/40' : 'bg-slate-300'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                      <div className="flex justify-between items-center mt-1 text-[8px]">
                                        <span className={isMe ? 'text-indigo-250' : 'text-slate-400'}>
                                          {playingAudioId === m.id ? 'Playing' : 'Voice note'}
                                        </span>
                                        <span className={isMe ? 'text-indigo-205' : 'text-slate-450'}>
                                          {m.body ? m.body.split('(')[1]?.split(')')[0] || '0:12' : '0:12'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  m.body
                                )}
                              </div>
                              
                              {/* Flag/Report action trigger for peer messages */}
                              {!isMe && (
                                <button
                                  onClick={() => setReportingMessage(m)}
                                  className="p-1 rounded bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition border border-slate-200/50 shadow-sm shrink-0"
                                  title="Report message"
                                >
                                  <Flag className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            
                            {/* Read receipts checkmarks */}
                            <span suppressHydrationWarning className="mt-1 text-[8px] text-slate-450 px-1 font-bold flex items-center gap-1">
                              {relativeTime}
                              {isMe && (
                                m.read_at ? (
                                  <span title="Read"><CheckCheck className="h-3.5 w-3.5 text-indigo-550" /></span>
                                ) : (
                                  <span title="Sent / Delivered"><Check className="h-3.5 w-3.5 text-slate-400" /></span>
                                )
                              )}
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </div>

            {/* Block Banner notice */}
            {(isBlocked || hasBlockedMe) && (
              <div className="bg-red-50 border-y border-red-200 p-3 text-[10px] text-red-750 flex items-center gap-2.5 font-bold justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500 animate-pulse" />
                <span>
                  {isBlocked 
                    ? 'You have blocked this user. Unblock them to resume messaging.' 
                    : 'This user has blocked you. You cannot send messages.'}
                </span>
              </div>
            )}

            {/* Composer Section */}
            <form onSubmit={handleSubmit} className="border-t border-slate-250 bg-white p-4 space-y-3 shadow-lg relative z-10 shrink-0">
              
              {/* Attachment Preview Box */}
              {filePreview && (
                <div className="flex items-center gap-3.5 p-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 relative animate-fadeIn">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                    <Image src={filePreview} alt="Preview" fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-800 truncate">{selectedFile?.name}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">
                      {(selectedFile!.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="p-1.5 text-slate-455 hover:text-slate-900 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Emoji Picker Popover overlay */}
              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  className="absolute bottom-20 left-4 w-72 h-48 bg-white border border-slate-250 rounded-2xl shadow-xl p-3 z-50 overflow-y-auto animate-scaleUp"
                >
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Select Reaction</p>
                  <div className="grid grid-cols-8 gap-2">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="text-base hover:scale-125 transition active:scale-95 flex items-center justify-center p-1 hover:bg-slate-100 rounded-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main controls row */}
              <div className="flex gap-2.5 items-end">
                {isRecordingVoice ? (
                  // Custom Mock Voice Note Recording Pane
                  <div className="flex-1 flex items-center gap-3 bg-slate-100/80 px-4 py-2.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-650 animate-ping" />
                      <span className="h-2 w-2 rounded-full bg-red-650 absolute" />
                      <span className="text-[10px] font-black text-red-650 mt-0.5">Recording</span>
                    </div>
                    
                    {/* Bouncing Visual Soundwaves */}
                    <div className="flex-1 flex items-center gap-0.5 h-4 justify-center">
                      {[1, 2, 3, 2, 4, 1, 3, 5, 2, 4, 2, 3, 1, 4, 2, 5, 3, 1, 2, 4, 1].map((n, i) => (
                        <div
                          key={i}
                          style={{ height: `${2 + n * 2}px` }}
                          className="w-[2px] bg-red-500 rounded-full animate-pulse"
                        />
                      ))}
                    </div>

                    <div className="text-[10px] font-mono font-bold text-slate-600">
                      {Math.floor(voiceSeconds / 60)}:{(voiceSeconds % 60).toString().padStart(2, '0')}
                    </div>

                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="p-1.5 hover:bg-red-55 text-red-550 rounded-lg border border-red-200 transition text-[9px] font-bold flex items-center gap-1.5 uppercase tracking-wide"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>

                    <button
                      type="button"
                      onClick={submitVoiceRecording}
                      disabled={isPending}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-2 font-bold transition shadow-sm hover:shadow-md disabled:bg-slate-200"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  // Normal Text Input Pane
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isBlocked || hasBlockedMe}
                    />
                    
                    {/* Paperclip upload trigger */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-slate-455 hover:text-slate-900 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="Upload Image"
                      disabled={isBlocked || hasBlockedMe}
                    >
                      <ImageIcon className="h-4.5 w-4.5" />
                    </button>

                    {/* Conversation Context button */}
                    <button
                      type="button"
                      onClick={() => setIsContextPanelOpen(true)}
                      className={`p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition shrink-0 ${
                        activeConvo.listing_title
                          ? 'text-indigo-600 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50'
                          : 'text-slate-455 hover:text-slate-900'
                      }`}
                      title="Conversation Context"
                    >
                      <LayoutList className="h-4.5 w-4.5" />
                    </button>

                    {/* Emoji trigger */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2.5 text-slate-455 hover:text-slate-900 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40 shrink-0 ${
                        showEmojiPicker ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''
                      }`}
                      title="Insert Emoji"
                      disabled={isBlocked || hasBlockedMe}
                    >
                      <Smile className="h-4.5 w-4.5" />
                    </button>

                    {/* Text Area */}
                    <div className="flex-1 min-w-0">
                      <textarea
                        ref={composerTextareaRef}
                        value={body}
                        onChange={handleBodyChange}
                        placeholder={(isBlocked || hasBlockedMe) ? 'Messaging locked...' : 'Type your message...'}
                        rows={1}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-none max-h-32 shadow-inner disabled:cursor-not-allowed"
                        disabled={isPending || isUploading || isBlocked || hasBlockedMe}
                        maxLength={2000}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                      />
                    </div>

                    {/* Mic Trigger */}
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="p-2.5 text-slate-455 hover:text-slate-900 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40 shrink-0"
                      title="Record Voice Note"
                      disabled={isBlocked || hasBlockedMe}
                    >
                      <Mic className="h-4.5 w-4.5" />
                    </button>

                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-3 font-bold transition shadow-sm hover:shadow-md disabled:bg-slate-100 disabled:text-slate-350 disabled:cursor-not-allowed shrink-0"
                      disabled={isPending || isUploading || isBlocked || hasBlockedMe || (!body.trim() && !selectedFile)}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      ) : (
                        <Send className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </>
                )}
              </div>
              
              {error && <p className="text-[10px] font-bold text-red-500 px-1">{error}</p>}
            </form>
          </>
        ) : (
          /* Empty Chat Selected View */
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500 space-y-3">
            <span className="text-4xl">✉️</span>
            <p className="text-xs font-bold text-slate-400 animate-pulse">Select a conversation thread</p>
            <p className="text-[10px] text-slate-550 max-w-xs leading-relaxed">
              Choose a buyer or creator conversation thread from the left menu to coordinate custom orders, pricing quotes, and details.
            </p>
          </div>
        )}
      </div>



      {/* ── REPORT MESSAGE MODAL DIALOG ──────────────────────── */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                <span>Report Message Content</span>
              </h3>
              <button
                onClick={() => setReportingMessage(null)}
                className="text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-50 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReportMessage} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 shadow-inner"
                >
                  <option value="spam">Spam / Advertisement</option>
                  <option value="scam">Scam / Fraudulent activity</option>
                  <option value="harassment">Harassment / Abusive behavior</option>
                  <option value="inappropriate_content">Inappropriate Content</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detailed Description</label>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  rows={3}
                  required
                  placeholder="Provide details about why you are reporting this message..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-850 placeholder-slate-455 focus:outline-none focus:border-indigo-500 shadow-inner resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReportingMessage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-250 text-xs font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="px-4 py-2 rounded-xl bg-red-650 hover:bg-red-600 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg shadow-red-500/10"
                >
                  {isReporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Flag className="h-3.5 w-3.5" />
                  )}
                  <span>Submit Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONVERSATION CONTEXT FULL-SCREEN PANEL ──────────────── */}
      {isContextPanelOpen && activeConvo && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-50 to-white animate-fadeIn">

          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <LayoutList className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Conversation Context</h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {isBuyingActive
                    ? `Chat with ${activeConvo.creator_display_name || 'Creator'}`
                    : `Chat with ${activeConvo.buyer_full_name || activeConvo.buyer_username || 'Buyer'}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsContextPanelOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Panel Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl w-full mx-auto space-y-6">

            {/* Linked Listing Card */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Linked Listing</p>
              {activeConvo.listing_title ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {activeConvo.listing_image_url && (
                    <div className="relative w-full h-48 bg-slate-100">
                      <Image
                        src={activeConvo.listing_image_url}
                        alt={activeConvo.listing_title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {activeConvo.custom_order_status && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow">
                          {activeConvo.custom_order_status}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-600 block mb-1">LINKED LISTING</span>
                      <h3 className="text-sm font-black text-slate-900 leading-snug">{activeConvo.listing_title}</h3>
                      {!activeConvo.listing_image_url && activeConvo.custom_order_status && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                          {activeConvo.custom_order_status}
                        </span>
                      )}
                    </div>
                    {activeConvo.listing_id && (
                      <Link
                        href={`/listings/${activeConvo.listing_id}`}
                        target="_blank"
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-[10px] font-bold text-slate-700 transition shadow-sm hover:shadow"
                      >
                        <span>View Listing</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Tag className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No listing linked</p>
                  <p className="text-[11px] text-slate-400 mt-1">This conversation has no specific listing attached.</p>
                </div>
              )}
            </section>

            {/* Custom Order Status */}
            {activeConvo.custom_order_status && (
              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Custom Order Status</p>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <ShoppingBag className="h-4.5 w-4.5 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 block">QUOTE DETAILS</span>
                      {activeConvo.custom_order_price && (
                        <span className="text-base font-black text-emerald-600">
                          ₹{activeConvo.custom_order_price.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-[9px] font-extrabold text-slate-600 uppercase tracking-wider border border-slate-200">
                    {activeConvo.custom_order_status}
                  </span>
                </div>
              </section>
            )}

            {/* Actions */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Actions</p>
              <div className="space-y-2">
                {isBuyingActive ? (
                  <>
                    {activeConvo.creator_slug && (
                      <Link
                        href={`/creators/${activeConvo.creator_slug}`}
                        target="_blank"
                        className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">View Creator Profile</span>
                            <span className="text-[10px] text-slate-400">/creators/{activeConvo.creator_slug}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition group-hover:translate-x-0.5" />
                      </Link>
                    )}
                    <Link
                      href="/dashboard/buyer/custom-orders"
                      className="flex items-center justify-between p-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 shadow-sm transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                          <Plus className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-indigo-700 block">Request Custom Order</span>
                          <span className="text-[10px] text-indigo-400">Commission a personalised piece</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600 transition group-hover:translate-x-0.5" />
                    </Link>
                  </>
                ) : (
                  <>
                    {activeConvo.buyer_username && (
                      <Link
                        href={`/u/${activeConvo.buyer_username}`}
                        target="_blank"
                        className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">View Buyer Profile</span>
                            <span className="text-[10px] text-slate-400">@{activeConvo.buyer_username}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition group-hover:translate-x-0.5" />
                      </Link>
                    )}
                    {activeConvo.inquiry_id && activeConvo.custom_order_status !== 'completed' && (
                      <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-3">Create Custom Offer</p>
                        <CustomOfferForm inquiryId={activeConvo.inquiry_id} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Panel Footer */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end">
            <button
              onClick={() => setIsContextPanelOpen(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );

  // ── RENDER CONVO ITEM HELPER ──────────────────────────────────────────────
  function renderConvoItem(c: ConversationWithDetails) {
    const isActive = c.id === activeId;
    const isBuying = c.buyer_id === profile.id;
    const titleName = isBuying 
      ? c.creator_display_name || 'Creator' 
      : c.buyer_full_name || c.buyer_username || 'Buyer';
    
    const relativeTime = c.last_message_at 
      ? new Date(c.last_message_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '';

    const initials = titleName.charAt(0).toUpperCase();
    const peerProfileId = isBuying ? c.seller_profile_id : c.buyer_id;
    
    const isPeerOnline = peerProfileId ? !!onlineUsers[peerProfileId] : false;
    const isPeerTyping = peerProfileId ? !!typingUsers[peerProfileId] : false;

    return (
      <Link
        key={c.id}
        href={`/messages?id=${c.id}${profile.role === 'creator' ? `&role=${activeInbox}` : ''}`}
        className={`flex items-start gap-3.5 p-4 text-left border-l-2 transition-all duration-200 ${
          isActive 
            ? 'bg-indigo-50/70 border-l-indigo-600 text-slate-900 shadow-sm' 
            : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {/* Avatar with Status Dot */}
        <div className="relative shrink-0 mt-0.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 font-black text-indigo-600 border border-indigo-100 text-sm shadow-sm">
            {initials}
          </div>
          {isPeerOnline && (
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className={`truncate text-xs font-bold ${c.unread_count > 0 ? 'text-indigo-700 font-black' : 'text-slate-800'}`}>
              {titleName}
            </h4>
            <span suppressHydrationWarning className="text-[9px] font-bold text-slate-400 shrink-0">{relativeTime}</span>
          </div>

          <p className={`mt-1 truncate text-[11px] leading-relaxed ${
            isPeerTyping 
              ? 'text-emerald-600 font-bold italic' 
              : (c.unread_count > 0 ? 'text-slate-900 font-black' : 'text-slate-50')
          }`}>
            {isPeerTyping ? 'Typing...' : (c.last_message_body || 'No messages yet')}
          </p>

          {/* Badges and Pin/Unread count row */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {c.listing_title && (
                <span className="shrink-0 rounded-lg bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 text-[9px] font-bold text-indigo-700 max-w-[120px] truncate">
                  🏷️ {c.listing_title}
                </span>
              )}
              {c.custom_order_status && (
                <span className="shrink-0 rounded-lg bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  📦 {c.custom_order_status}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {c.is_pinned && <Pin className="h-3 w-3 text-indigo-500 shrink-0 fill-current rotate-[45deg]" />}
              {c.unread_count > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-extrabold text-white">
                  {c.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }
}
