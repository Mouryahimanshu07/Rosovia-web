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
  HelpCircle, 
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
  AlertTriangle
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
  reportMessageAction
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
  const [activeTab, setActiveTab] = React.useState<'all' | 'buying' | 'selling' | 'unread' | 'archived'>('all');
  const [body, setBody] = React.useState('');
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Realtime States
  const [onlineUsers, setOnlineUsers] = React.useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = React.useState<Record<string, boolean>>({});
  
  // Attachments State
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  
  // Panel Toggles
  const [showRightDrawer, setShowRightDrawer] = React.useState(true);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  // Blocking and Moderation
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [hasBlockedMe, setHasBlockedMe] = React.useState(false);
  const [reportingMessage, setReportingMessage] = React.useState<MessageWithSender | null>(null);
  const [reportReason, setReportReason] = React.useState('spam');
  const [reportDesc, setReportDesc] = React.useState('');
  const [isReporting, setIsReporting] = React.useState(false);

  // References
  const messageEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state if props change
  React.useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  React.useEffect(() => {
    setMessages(initialMessages);
    scrollToBottom('auto');
  }, [initialMessages, activeId]);

  // ── SCROLL HELPER ─────────────────────────────────────────────────────────
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Active Convo helper properties
  const activeConvo = conversations.find((c) => c.id === activeId);
  const isBuyingActive = activeConvo?.buyer_profile_id === profile.id;
  
  const counterPartyName = activeConvo 
    ? (isBuyingActive ? activeConvo.creator_display_name || 'Creator' : activeConvo.buyer_full_name || activeConvo.buyer_username || 'Buyer')
    : '';
  
  const counterPartyProfileId = activeConvo
    ? (isBuyingActive ? activeConvo.seller_profile_id : activeConvo.buyer_profile_id)
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
    if (!activeId) return;

    // Subscribe to Postgres Changes for new messages in this conversation
    const channel = supabase
      .channel(`chat:${activeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeId}`,
        },
        async (payload: any) => {
          const newMsg = payload.new;
          
          // Fetch sender profile info dynamically to enrich local state
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

          setMessages((prev) => {
            if (prev.some((m) => m.id === enrichedMsg.id)) return prev;
            return [...prev, enrichedMsg];
          });
          
          scrollToBottom();
          router.refresh();
        }
      )
      .subscribe();

    // Subscribe to typing updates using Broadcast Channel
    const typingChannel = supabase
      .channel(`typing:${activeId}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const { senderId, isTyping } = payload.payload;
        if (senderId !== profile.id) {
          setTypingUsers((prev) => ({ ...prev, [senderId]: isTyping }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [activeId, profile.id, supabase, router]);

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
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    
    // Broadcast typing state
    if (activeId) {
      supabase.channel(`typing:${activeId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: profile.id, isTyping: e.target.value.length > 0 }
      });
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
            conversationId: activeId,
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
            conversationId: activeId,
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
  const filteredConversations = conversations.filter((c) => {
    const isBuying = c.buyer_profile_id === profile.id;
    const isSelling = c.seller_profile_id === profile.id;

    // Search query matching
    const displayName = isBuying 
      ? c.creator_display_name || 'Creator' 
      : c.buyer_full_name || c.buyer_username || 'Buyer';
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.last_message_body && c.last_message_body.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Tab matching
    if (activeTab === 'buying') return isBuying;
    if (activeTab === 'selling') return isSelling;
    if (activeTab === 'unread') return c.unread_count > 0;
    if (activeTab === 'archived') return c.is_archived;

    // By default ('all'), do not show archived conversations
    return !c.is_archived;
  });

  // Calculate unread badge count for tab headers
  const unreadCountForTab = conversations.filter((c) => c.unread_count > 0 && !c.is_archived).length;
  const buyingCountForTab = conversations.filter((c) => c.buyer_profile_id === profile.id && !c.is_archived).length;
  const sellingCountForTab = conversations.filter((c) => c.seller_profile_id === profile.id && !c.is_archived).length;

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
    <div className="grid grid-cols-12 h-[calc(100vh-8.5rem)] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900 relative">
      
      {/* ── PANEL 1: CONVERSATION LIST (LEFT PANEL) ─────────────────────────── */}
      <div className={`col-span-12 md:col-span-4 flex flex-col border-r border-slate-200 bg-white/60 relative z-10 ${activeId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Search & Tabs Header (No Overlap) */}
        <div className="p-4 space-y-4 shrink-0 border-b border-slate-200/80 bg-white/40">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:bg-white shadow-inner focus:outline-none focus:border-indigo-600 transition duration-150 shadow-inner"
            />
          </div>

          {/* Filter Tabs Capsules */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {([
              { key: 'all', label: 'All', count: undefined },
              { key: 'buying', label: 'Buying', count: buyingCountForTab },
              { key: 'selling', label: 'Selling', count: sellingCountForTab },
              { key: 'unread', label: 'Unread', count: unreadCountForTab },
              { key: 'archived', label: 'Archived', count: undefined }
            ] as const).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all duration-150 whitespace-nowrap flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full text-[8px] font-black ${
                      isActive ? 'bg-indigo-750 text-white' : 'bg-indigo-100 text-indigo-700'
                    } px-1`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List scroll wrapper */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-slate-50/20">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-64 space-y-2">
              <span className="text-3xl">💬</span>
              <p className="text-xs font-bold text-slate-350">No conversations found</p>
              <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                Start connecting with buyers or creators from the explore pages.
              </p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeId;
              const isBuying = c.buyer_profile_id === profile.id;
              const titleName = isBuying 
                ? c.creator_display_name || 'Creator' 
                : c.buyer_full_name || c.buyer_username || 'Buyer';
              
              const relativeTime = c.last_message_at 
                ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              const initials = titleName.charAt(0).toUpperCase();
              const peerProfileId = isBuying ? c.seller_profile_id : c.buyer_profile_id;
              const isPeerOnline = peerProfileId ? !!onlineUsers[peerProfileId] : false;
              const isPeerTyping = peerProfileId ? !!typingUsers[peerProfileId] : false;

              return (
                <Link
                  key={c.id}
                  href={`/dashboard/messages?id=${c.id}${profile.role === 'creator' ? `&role=${currentRole}` : ''}`}
                  className={`flex items-start gap-3.5 p-4 text-left border-l-2 transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50/80 border-l-indigo-600 text-slate-900 shadow-sm' 
                      : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {/* Avatar with status dot */}
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
                      <h4 className={`truncate text-xs font-bold ${c.unread_count > 0 ? 'text-indigo-650' : 'text-slate-850'}`}>
                        {titleName}
                      </h4>
                      <span className="text-[9px] font-semibold text-slate-500 shrink-0">{relativeTime}</span>
                    </div>

                    <p className={`mt-1 truncate text-[11px] ${
                      isPeerTyping 
                        ? 'text-emerald-650 font-semibold italic' 
                        : (c.unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-500')
                    }`}>
                      {isPeerTyping ? 'Typing...' : (c.last_message_body || 'No messages yet')}
                    </p>

                    {/* Context/ref Badges & pin indicators */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {c.listing_title && (
                          <span className="shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700 max-w-[120px] truncate">
                            🏷️ {c.listing_title}
                          </span>
                        )}
                        {c.custom_order_status && (
                          <span className="shrink-0 rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                            📦 {c.custom_order_status}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.is_pinned && <Pin className="h-3 w-3 text-indigo-500 shrink-0" />}
                        {c.unread_count > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-extrabold text-white animate-pulse">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── PANEL 2: ACTIVE CHAT WINDOW (MIDDLE PANEL) ──────────────────────── */}
      <div className={`col-span-12 md:col-span-8 flex flex-col bg-white/20 relative ${activeId ? 'flex' : 'hidden md:flex'}`}>
        {activeConvo ? (
          <>
            {/* Top Bar Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-white/80 backdrop-blur-md relative z-25">
              
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <Link
                  href={`/dashboard/messages${profile.role === 'creator' ? `?role=${currentRole}` : ''}`}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-50 md:hidden transition"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                
                {/* Peer user details */}
                <div>
                  <h3 className="text-xs font-bold text-slate-850 flex items-center gap-2">
                    {counterPartyName}
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600 tracking-wide uppercase">
                      {isBuyingActive ? 'Creator' : 'Client'}
                    </span>
                  </h3>
                  
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                    {isCounterPartyTyping ? (
                      <span className="text-emerald-600 font-semibold italic animate-pulse">typing...</span>
                    ) : (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${isCounterPartyOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{isCounterPartyOnline ? 'Active now' : 'Offline'}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat action controls */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowRightDrawer(!showRightDrawer)}
                  className={`p-2 text-slate-400 hover:text-slate-900 transition rounded-xl hover:bg-slate-50 hidden lg:block border border-transparent ${
                    showRightDrawer ? 'bg-indigo-50 border-indigo-200/60 text-indigo-600 shadow-sm' : ''
                  }`}
                  title="Toggle Workspace Context"
                >
                  <ShoppingBag className="h-4.5 w-4.5" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 text-slate-400 hover:text-slate-900 transition rounded-xl hover:bg-slate-50 border border-transparent"
                  >
                    <MoreVertical className="h-4.5 w-4.5" />
                  </button>

                  {/* Dropdown Options */}
                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-250 bg-white p-1.5 shadow-xl z-50">
                      <button
                        onClick={handlePin}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition"
                      >
                        <Pin className="h-4 w-4 text-indigo-500" />
                        <span>{activeConvo.is_pinned ? 'Unpin conversation' : 'Pin conversation'}</span>
                      </button>
                      <button
                        onClick={handleArchive}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition"
                      >
                        <Archive className="h-4 w-4 text-emerald-500" />
                        <span>{activeConvo.is_archived ? 'Move to inbox' : 'Archive conversation'}</span>
                      </button>
                      <button
                        onClick={handleMute}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition"
                      >
                        <VolumeX className="h-4 w-4 text-blue-500" />
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
            <div className="bg-indigo-50/80 border-b border-indigo-100 px-6 py-2.5 text-[10px] text-indigo-750 flex items-center gap-2 font-semibold backdrop-blur-sm">
              <span>📨</span>
              <span>
                To optimize deliverability, replies are automatically mirrored to the counterparty&apos;s email address.
              </span>
            </div>

            {/* Middle Message Flow Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <span className="text-3xl">✍️</span>
                  <p className="text-xs font-bold text-slate-350">Discuss requirements & specs</p>
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
                    if (m.body.startsWith('[CUSTOM_OFFER]:')) {
                      try {
                        offer = JSON.parse(m.body.substring('[CUSTOM_OFFER]:'.length));
                      } catch (e) {}
                    }

                    const relativeTime = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    // Consecutive messages spacing logic
                    const nextMsg = messages[index + 1];
                    const isConsecutive = nextMsg && nextMsg.sender_profile_id === m.sender_profile_id;

                    return (
                      <React.Fragment key={m.id}>
                        {/* Date Divider */}
                        {showDateSeparator && (
                          <div className="flex justify-center my-5 relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                              <div className="w-full border-t border-slate-200/40" />
                            </div>
                            <span className="relative px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              {formatDividerDate(m.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Proposal Card Bubble */}
                        {offer ? (
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full mb-4`}>
                            <div className={`max-w-[85%] sm:max-w-[65%] rounded-3xl p-5 shadow-lg border backdrop-blur-sm ${
                              isMe
                                ? 'bg-indigo-50/70 text-slate-800 border-indigo-150 rounded-tr-none'
                                : 'bg-white text-slate-800 border-slate-200 rounded-tl-none shadow-md'
                            }`}>
                              <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-200/60">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-650 flex items-center gap-1.5">
                                  ⚡ Commission proposal
                                </span>
                                <span className="rounded-lg bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[9px] font-bold text-indigo-700">
                                  Quoted
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-500">Proposed Quote</span>
                                  <span className="text-xl font-black text-emerald-600 mt-1 block">₹{offer.price.toLocaleString('en-IN')}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-500">Delivery timeframe</span>
                                  <span className="text-xs font-bold text-indigo-650 mt-1 block">🕒 {offer.deliveryDays} Days</span>
                                </div>
                              </div>

                              {offer.note && (
                                <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap bg-white/80 p-3 rounded-xl border border-slate-200">
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
                            <span className="mt-1.5 text-[8px] text-slate-500 px-1 font-semibold">{relativeTime}</span>
                          </div>
                        ) : (
                          /* Standard Message Bubble */
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isConsecutive ? 'mb-1' : 'mb-4'} group relative`}>
                            <div className="flex items-center gap-2 max-w-[75%]">
                              {/* Bubble element */}
                              <div className={`rounded-2xl px-4 py-2.5 text-xs shadow-md leading-relaxed whitespace-pre-wrap break-words border ${
                                isMe
                                  ? 'bg-gradient-to-r from-indigo-600 to-violet-650 text-white rounded-tr-none border-indigo-500/10'
                                  : 'bg-white text-slate-800 rounded-tl-none border-slate-200/80 shadow-sm'
                              }`}>
                                {/* Image Attachment rendering */}
                                {m.attachment_url && (
                                  <div className="relative w-56 h-36 rounded-xl overflow-hidden mb-2.5 bg-white border border-slate-200 shadow-inner">
                                    <Image src={m.attachment_url} alt="Attachment" fill unoptimized className="object-cover" />
                                  </div>
                                )}
                                {m.body}
                              </div>
                              
                              {/* Flag/Report action trigger for peer messages */}
                              {!isMe && (
                                <button
                                  onClick={() => setReportingMessage(m)}
                                  className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-red-655 opacity-0 group-hover:opacity-100 transition border border-slate-200"
                                  title="Report/Flag message"
                                >
                                  <Flag className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            
                            {/* Read receipts checkmarks */}
                            <span className="mt-1 text-[8px] text-slate-500 px-1 font-semibold flex items-center gap-1">
                              {relativeTime}
                              {isMe && (
                                m.read_at ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-indigo-400" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-slate-500" />
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
              <div ref={messageEndRef} />
            </div>

            {/* Block Banner notice */}
            {(isBlocked || hasBlockedMe) && (
              <div className="bg-red-950/20 border-y border-red-900/30 p-3 text-[10px] text-red-300 flex items-center gap-2.5 font-bold justify-center">
                <AlertTriangle className="h-4.5 w-4.5" />
                <span>
                  {isBlocked 
                    ? 'You have blocked this user. Unblock them to resume messaging.' 
                    : 'This user has blocked you. You cannot send messages.'}
                </span>
              </div>
            )}

            {/* Composer Section */}
            <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 space-y-3 shadow-md relative z-10 shadow-lg">
              
              {/* Attachment Preview Box */}
              {filePreview && (
                <div className="flex items-center gap-3.5 p-3 bg-slate-50/50 rounded-2xl border border-slate-200 relative animate-fadeIn">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-200">
                    <Image src={filePreview} alt="Preview" fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-850 truncate">{selectedFile?.name}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">
                      {(selectedFile!.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="p-1.5 text-slate-400 hover:text-slate-950 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-2.5 items-end">
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
                  className="p-2.5 text-slate-500 hover:text-slate-950 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Upload Image"
                  disabled={isBlocked || hasBlockedMe}
                >
                  <ImageIcon className="h-4.5 w-4.5" />
                </button>

                {/* Emoji menu coming soon popup */}
                <button
                  type="button"
                  onClick={() => alert('Emoji selection coming soon!')}
                  className="p-2.5 text-slate-500 hover:text-slate-950 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40"
                  title="Insert Emoji"
                  disabled={isBlocked || hasBlockedMe}
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>

                {/* Main text message compose field */}
                <div className="flex-1">
                  <textarea
                    value={body}
                    onChange={handleBodyChange}
                    placeholder={(isBlocked || hasBlockedMe) ? 'Messaging locked...' : 'Type your message...'}
                    rows={1}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-850 placeholder-slate-500 focus:outline-none focus:border-indigo-600 resize-none max-h-32 shadow-inner disabled:cursor-not-allowed"
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

                {/* Voice Note Placeholder */}
                <button
                  type="button"
                  onClick={() => alert('Voice notes recording placeholder')}
                  className="p-2.5 text-slate-500 hover:text-slate-955 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-40"
                  title="Record Voice Note"
                  disabled={isBlocked || hasBlockedMe}
                >
                  <Mic className="h-4.5 w-4.5" />
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-3 font-bold transition shadow-md disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  disabled={isPending || isUploading || isBlocked || hasBlockedMe || (!body.trim() && !selectedFile)}
                >
                  {isUploading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Send className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              
              {error && <p className="text-[10px] font-bold text-red-500 px-1">{error}</p>}
            </form>
          </>
        ) : (
          /* Empty Chat Selected View */
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500 space-y-3">
            <span className="text-4xl">✉️</span>
            <p className="text-xs font-bold text-slate-400">Select a discussion thread</p>
            <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
              Choose a buyer or creator conversation thread from the left menu to coordinate custom orders, pricing quotes, and details.
            </p>
          </div>
        )}
      </div>

      {/* ── PANEL 3: CONTEXT PANEL (RIGHT DRAWER) ───────────────────────────── */}
      {activeConvo && showRightDrawer && (
        <div className="col-span-12 lg:col-span-3 border-l border-slate-200 bg-white p-6 space-y-6 hidden lg:block overflow-y-auto z-20">
          
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conversation Context</h4>
            
            {/* Listing Reference Info Card */}
            {activeConvo.listing_title ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-md hover:border-slate-200 transition duration-300">
                {activeConvo.listing_image_url && (
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shadow-inner shadow-slate-200/50">
                    <Image src={activeConvo.listing_image_url} alt="Listing" fill unoptimized className="object-cover" />
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-650">Discussed listing</span>
                  <h5 className="text-xs font-bold text-slate-850 mt-1">{activeConvo.listing_title}</h5>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 border-dashed p-4 text-center text-slate-500 text-[10px] leading-relaxed">
                No specific listings linked to this chat thread.
              </div>
            )}

            {/* Custom Proposal reference */}
            {activeConvo.custom_order_status && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-md">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-650">Associated Quote status</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-emerald-600">
                    {activeConvo.custom_order_price ? `₹${activeConvo.custom_order_price.toLocaleString('en-IN')}` : 'Quoted'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-50 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider border border-slate-200">
                    {activeConvo.custom_order_status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Panel based on Buyer/Seller role */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connected Actions</h4>
            
            {isBuyingActive ? (
              /* Actions for Buyer */
              <div className="grid gap-2">
                {activeConvo.creator_slug && (
                  <Link
                    href={`/creators/${activeConvo.creator_slug}`}
                    target="_blank"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] shadow-sm font-bold transition duration-150 group"
                  >
                    <span>View Workspace Profile</span>
                    <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition" />
                  </Link>
                )}
                {activeConvo.listing_id && (
                  <Link
                    href={`/listings/${activeConvo.listing_id}`}
                    target="_blank"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] shadow-sm font-bold transition duration-150 group"
                  >
                    <span>Inspect Listing specs</span>
                    <Tag className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition" />
                  </Link>
                )}
                {/* Make inquiry / Request custom order shortcuts */}
                <Link
                  href={`/dashboard/buyer/custom-orders`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] shadow-sm font-bold transition duration-150 group bg-indigo-50/40 hover:border-indigo-200"
                >
                  <span>Request custom order</span>
                  <Plus className="h-4 w-4 text-indigo-650 transition" />
                </Link>
              </div>
            ) : (
              /* Actions for Seller */
              <div className="grid gap-2">
                {activeConvo.buyer_username && (
                  <Link
                    href={`/u/${activeConvo.buyer_username}`}
                    target="_blank"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] shadow-sm font-bold transition duration-150 group"
                  >
                    <span>View Buyer Profile</span>
                    <User className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition" />
                  </Link>
                )}
                
                {/* Generate custom offers button for inquiry DMs */}
                {activeConvo.inquiry_id && activeConvo.custom_order_status !== 'completed' && (
                  <div className="pt-2 border-t border-slate-200 mt-2">
                    <CustomOfferForm inquiryId={activeConvo.inquiry_id} />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── REPORT MESSAGE MODAL DIALOG ──────────────────────── */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                <span>Report Message Content</span>
              </h3>
              <button
                onClick={() => setReportingMessage(null)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-50 transition"
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
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-inner resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReportingMessage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="px-4 py-2 rounded-xl bg-red-650 hover:bg-red-500 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg shadow-red-500/10"
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

    </div>
  );
}
