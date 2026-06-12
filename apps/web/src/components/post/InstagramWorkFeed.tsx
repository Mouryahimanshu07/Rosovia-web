'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  CheckCircle2,
  Play,
  VolumeX,
  Volume2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Loader2,
  Trash2,
  Send
} from 'lucide-react';
import type { CreatorPostWithDetails, Profile } from '@rosovia/core';
import {
  toggleLikePostAction,
  toggleSavePostAction,
  addCommentAction,
  deleteCommentAction,
  getPostCommentsAction,
  fetchMoreWorkPostsAction
} from '~/app/actions/posts';
import { followProfileAction, unfollowProfileAction } from '~/app/actions/follows';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface InstagramWorkFeedProps {
  initialPosts: CreatorPostWithDetails[];
  query: string;
  activeTab: string;
  currentUserProfile?: Profile | null;
}

export function InstagramWorkFeed({
  initialPosts,
  query,
  activeTab,
  currentUserProfile
}: InstagramWorkFeedProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<CreatorPostWithDetails[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(initialPosts.length >= 10);
  const observerTarget = useRef<HTMLDivElement>(null);

  const viewerProfileId = currentUserProfile?.id;
  const viewerAuthUserId = currentUserProfile?.auth_user_id;

  useEffect(() => {
    setPosts((prev) => {
      const oldIds = prev.map((p) => p.id).join(',');
      const newIds = initialPosts.map((p) => p.id).join(',');
      if (oldIds === newIds) {
        return prev.map((oldPost) => {
          const newPost = initialPosts.find((p) => p.id === oldPost.id);
          if (!newPost) return oldPost;
          return {
            ...oldPost,
            ...newPost,
          };
        });
      }
      return initialPosts;
    });
    setPage(1);
    setHasNext(initialPosts.length >= 10);
  }, [initialPosts]);

  // Load more posts
  const loadMore = async () => {
    if (loading || !hasNext) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetchMoreWorkPostsAction({
        page: nextPage,
        q: query || undefined,
        sort: 'newest'
      });
      if (res.success && res.data) {
        const newPosts = res.data.data;
        if (newPosts.length > 0) {
          setPosts((prev) => {
            // filter out duplicates
            const existingIds = new Set(prev.map((p) => p.id));
            const filtered = newPosts.filter((p) => !existingIds.has(p.id));
            return [...prev, ...filtered];
          });
          setPage(nextPage);
        }
        setHasNext(res.data.hasNext);
      } else {
        setHasNext(false);
      }
    } catch (err) {
      console.error('Failed to load more work feed posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Intersection observer for infinite scroll
  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasNext, page, loading, query]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm max-w-2xl mx-auto mt-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-3xl">
          🎨
        </div>
        <h3 className="text-lg font-bold text-slate-800">No work posts found</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          {query
            ? `We couldn't find any work posts matching "${query}". Try another search term.`
            : 'No work posts have been shared yet. Check back later!'}
        </p>
        {query && (
          <button
            onClick={() => router.push('/explore')}
            className="mt-4 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full shadow transition"
          >
            Clear Search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-8 md:gap-10 pb-16">
      <div className="w-full max-w-[680px] flex flex-col gap-8">
        {posts.map((post) => (
          <InstagramPostCard
            key={post.id}
            post={post}
            viewerProfileId={viewerProfileId}
            viewerAuthUserId={viewerAuthUserId}
            router={router}
            onPostUpdate={(updatedFields) => {
              setPosts((prev) =>
                prev.map((p) => (p.id === updatedFields.id ? { ...p, ...updatedFields } : p))
              );
            }}
          />
        ))}
      </div>

      {/* Loading Skeleton / Loader */}
      {hasNext && (
        <div ref={observerTarget} className="w-full flex justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading more amazing work...</span>
            </div>
          ) : (
            <button
              onClick={loadMore}
              className="px-6 py-2.5 rounded-full border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:border-indigo-300 hover:text-indigo-600 transition shadow-sm"
            >
              Load More Work
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   InstagramPostCard Component
   ───────────────────────────────────────────────────────────────────────────── */
interface InstagramPostCardProps {
  post: CreatorPostWithDetails;
  viewerProfileId?: string;
  viewerAuthUserId?: string;
  router: any;
  onPostUpdate?: (updatedPost: Partial<CreatorPostWithDetails> & { id: string }) => void;
}

function InstagramPostCard({
  post,
  viewerProfileId,
  viewerAuthUserId,
  router,
  onPostUpdate
}: InstagramPostCardProps) {
  const [liked, setLiked] = useState(!!post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(!!post.savedByViewer);
  const [saveCount, setSaveCount] = useState(post.save_count);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.comment_count ?? 0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Video playback
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Share indicator
  const [shareCopied, setShareCopied] = useState(false);

  const isOwner = viewerProfileId === post.creator_user_id;
  const isAnonymous = !viewerProfileId;

  // Creator profile link
  const creatorProfileUrl = post.creator_profile_username
    ? `/u/${post.creator_profile_username}`
    : `/creators/${post.creator_slug}`;

  // Sync state with props
  useEffect(() => {
    setLiked(!!post.likedByViewer);
    setLikeCount(post.like_count);
    setSaved(!!post.savedByViewer);
    setSaveCount(post.save_count);
  }, [post.likedByViewer, post.like_count, post.savedByViewer, post.save_count]);

  // Fetch relationship state
  useEffect(() => {
    if (!isAnonymous && post.id) {
      // Check if following creator profile
      const checkFollowing = async () => {
        if (!post.creator_user_id) return;
        try {
          const { data: followRow } = await getFollowRowClient(post.creator_user_id);
          setIsFollowing(!!followRow);
        } catch {}
      };
      checkFollowing();
    }
  }, [post.id, isAnonymous, post.creator_user_id]);

  // Client side fetch follow row helper
  const getFollowRowClient = async (targetProfileId: string) => {
    try {
      const { createSupabaseBrowserClient } = await import('@rosovia/integrations/browser');
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null };

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) return { data: null };

      return await supabase
        .from('profile_follows')
        .select('*')
        .eq('follower_profile_id', profile.id)
        .eq('following_profile_id', targetProfileId)
        .maybeSingle();
    } catch {
      return { data: null };
    }
  };

  const handleAuthRedirect = () => {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    router.push(`/login?redirectTo=${returnUrl}`);
  };

  // Like Toggle
  const handleLike = async () => {
    if (isAnonymous) {
      handleAuthRedirect();
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);

    const oldLiked = liked;
    const oldLikeCount = likeCount;
    const newLiked = !liked;
    const newLikeCount = newLiked ? oldLikeCount + 1 : Math.max(0, oldLikeCount - 1);

    // 1. Optimistic update
    setLiked(newLiked);
    setLikeCount(newLikeCount);
    if (onPostUpdate) {
      onPostUpdate({
        id: post.id,
        likedByViewer: newLiked,
        like_count: newLikeCount,
      });
    }

    try {
      const res = await toggleLikePostAction(post.id);
      if (res.success && res.data) {
        // 2. Set backend values
        setLiked(res.data.likedByViewer);
        setLikeCount(res.data.likeCount);
        if (onPostUpdate) {
          onPostUpdate({
            id: post.id,
            likedByViewer: res.data.likedByViewer,
            like_count: res.data.likeCount,
          });
        }
      } else {
        // 3. Rollback on failure
        setLiked(oldLiked);
        setLikeCount(oldLikeCount);
        if (onPostUpdate) {
          onPostUpdate({
            id: post.id,
            likedByViewer: oldLiked,
            like_count: oldLikeCount,
          });
        }
      }
    } catch {
      // 3. Rollback on error
      setLiked(oldLiked);
      setLikeCount(oldLikeCount);
      if (onPostUpdate) {
        onPostUpdate({
          id: post.id,
          likedByViewer: oldLiked,
          like_count: oldLikeCount,
        });
      }
    } finally {
      setLikeLoading(false);
    }
  };

  // Save Toggle
  const handleSave = async () => {
    if (isAnonymous) {
      handleAuthRedirect();
      return;
    }
    if (saveLoading) return;
    setSaveLoading(true);

    const oldSaved = saved;
    const oldSaveCount = saveCount;
    const newSaved = !saved;
    const newSaveCount = newSaved ? oldSaveCount + 1 : Math.max(0, oldSaveCount - 1);

    // 1. Optimistic update
    setSaved(newSaved);
    setSaveCount(newSaveCount);
    if (onPostUpdate) {
      onPostUpdate({
        id: post.id,
        savedByViewer: newSaved,
        save_count: newSaveCount,
      });
    }

    try {
      const res = await toggleSavePostAction(post.id);
      if (res.success && res.data) {
        // 2. Set backend values
        setSaved(res.data.savedByViewer);
        setSaveCount(res.data.saveCount);
        if (onPostUpdate) {
          onPostUpdate({
            id: post.id,
            savedByViewer: res.data.savedByViewer,
            save_count: res.data.saveCount,
          });
        }
      } else {
        // 3. Rollback on failure
        setSaved(oldSaved);
        setSaveCount(oldSaveCount);
        if (onPostUpdate) {
          onPostUpdate({
            id: post.id,
            savedByViewer: oldSaved,
            save_count: oldSaveCount,
          });
        }
      }
    } catch {
      // 3. Rollback on error
      setSaved(oldSaved);
      setSaveCount(oldSaveCount);
      if (onPostUpdate) {
        onPostUpdate({
          id: post.id,
          savedByViewer: oldSaved,
          save_count: oldSaveCount,
        });
      }
    } finally {
      setSaveLoading(false);
    }
  };

  // Follow Action
  const handleFollowToggle = async () => {
    if (isAnonymous) {
      handleAuthRedirect();
      return;
    }
    if (!post.creator_user_id || !post.creator_profile_username) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const res = await unfollowProfileAction(post.creator_user_id, post.creator_profile_username);
        if (res.success && res.data) {
          setIsFollowing(res.data.isFollowing);
        } else if (res.success) {
          setIsFollowing(false);
        }
      } else {
        const res = await followProfileAction(post.creator_user_id, post.creator_profile_username);
        if (res.success && res.data) {
          setIsFollowing(res.data.isFollowing);
        } else if (res.success) {
          setIsFollowing(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  // Load Comments
  const toggleComments = async () => {
    const nextShow = !showComments;
    setShowComments(nextShow);

    if (nextShow && comments.length === 0) {
      setCommentsLoading(true);
      try {
        const res = await getPostCommentsAction(post.id);
        if (res.success && res.data) {
          setComments(res.data);
          setCommentsCount(res.data.length);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnonymous) {
      handleAuthRedirect();
      return;
    }
    const trimmedBody = newCommentBody.trim();
    if (!trimmedBody || commentSubmitting) return;
    if (trimmedBody.length > 500) {
      alert('Comment must be 500 characters or less');
      return;
    }

    setCommentSubmitting(true);
    try {
      const res = await addCommentAction(post.id, trimmedBody);
      if (res.success) {
        if (res.data) {
          setComments((prev) => [...prev, res.data]);
          setCommentsCount((c) => c + 1);
          setNewCommentBody('');
        }
      } else {
        alert(res.error || 'Failed to submit comment');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await deleteCommentAction(commentId);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsCount((c) => Math.max(0, c - 1));
      } else {
        alert(res.error || 'Failed to delete comment');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Share Action
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/u/${post.creator_profile_username}/posts#post-${post.id}`;
    const shareData = {
      title: `${post.creator_display_name || 'Rosovia Creator'} on Rosovia`,
      text: post.caption || 'Check out this amazing work on Rosovia!',
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch((err) => {
        console.error('Error sharing:', err);
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy link: ', err);
      });
    }
  };

  // Media render
  const firstMedia = post.media[0];
  const isVideo = firstMedia?.media_type === 'video' || firstMedia?.mime_type?.startsWith('video/');

  return (
    <article id={`post-${post.id}`} className="w-full bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden flex flex-col transition hover:shadow-lg">
      
      {/* Post Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href={creatorProfileUrl} className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-100 bg-slate-50 flex-shrink-0">
            {post.creator_profile_image_url ? (
              <Image
                src={post.creator_profile_image_url}
                alt={post.creator_display_name ?? ''}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-indigo-500 font-bold bg-indigo-50 text-sm">
                {post.creator_display_name?.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link href={creatorProfileUrl} className="font-bold text-slate-800 text-sm hover:text-indigo-600 transition truncate">
                {post.creator_display_name}
              </Link>
              {post.creator_is_verified && (
                <CheckCircle2 className="h-4 w-4 text-violet-600 fill-violet-100 flex-shrink-0" />
              )}
            </div>
            {post.creator_profile_username && (
              <span className="text-xs text-slate-400 font-medium">
                @{post.creator_profile_username}
              </span>
            )}
          </div>
        </div>

        {/* Follow Creator Action (hidden for owner) */}
        {!isOwner && (
          <button
            onClick={handleFollowToggle}
            disabled={followLoading}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
              isFollowing
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
            }`}
          >
            {followLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isFollowing ? (
              'Following'
            ) : (
              'Follow'
            )}
          </button>
        )}
      </div>

      {/* Post Media Area */}
      <div className="relative w-full aspect-square md:aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center">
        {firstMedia ? (
          isVideo ? (
            <div className="relative w-full h-full group/video">
              <video
                ref={videoRef}
                src={firstMedia.public_url ?? ''}
                controls
                preload="metadata"
                muted={isMuted}
                playsInline
                className="w-full h-full object-contain"
              />
              {/* Custom mute/unmute overlay overlay */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition-all border border-white/10 z-10"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <div className="w-full h-full relative">
              <Image
                src={firstMedia.public_url ?? ''}
                alt={post.caption ?? 'Creator Work Post'}
                fill
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover"
                unoptimized
              />
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50/50 to-purple-50/50 text-indigo-500 text-5xl">
            🎨
          </div>
        )}
      </div>

      {/* Linked Listing Showcase Card */}
      {post.post_type === 'listing_showcase' && post.listing && (
        <div className="px-5 pt-4">
          <Link
            href={`/listings/${post.listing.slug}`}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-indigo-50 bg-indigo-50/20 hover:bg-indigo-50/40 hover:border-indigo-100 transition-all duration-200 shadow-sm"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">
                🏪 Showcasing Listing
              </span>
              <h4 className="text-sm font-semibold text-slate-800 truncate">
                {post.listing.title}
              </h4>
            </div>
            <div className="flex-shrink-0 ml-3">
              {post.listing.price !== null ? (
                <span className="text-xs font-bold text-indigo-700 bg-white border border-indigo-100 rounded-lg px-2.5 py-1 inline-block shadow-sm">
                  {post.listing.currency} {post.listing.price.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-xs italic text-slate-400 bg-white border border-slate-100 rounded-lg px-2.5 py-1 inline-block shadow-sm">
                  Price on Request
                </span>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Engagement Actions Row */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={likeLoading}
            className="group flex items-center gap-1.5 text-slate-600 hover:text-rose-600 transition disabled:opacity-60"
            title="Like Post"
          >
            <Heart
              className={`h-6 w-6 transition-transform group-active:scale-125 ${
                liked ? 'text-rose-600 fill-rose-600' : ''
              }`}
            />
            <span className="text-xs font-bold text-slate-700">{likeCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={toggleComments}
            className="group flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition"
            title="View Comments"
          >
            <MessageCircle className="h-6 w-6 transition-transform group-active:scale-110" />
            <span className="text-xs font-bold text-slate-700">{commentsCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-slate-600 hover:text-teal-600 transition relative"
            title="Copy post link"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-xs font-bold text-slate-700">Share</span>
            {shareCopied && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 text-[10px] font-bold text-white bg-slate-800 rounded shadow animate-bounce">
                Copied!
              </span>
            )}
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saveLoading}
          className="flex items-center gap-1.5 text-slate-600 hover:text-amber-500 transition disabled:opacity-60"
          title="Save Post"
        >
          <Bookmark className={`h-6 w-6 ${saved ? 'text-amber-500 fill-amber-500' : ''}`} />
          <span className="text-xs font-bold text-slate-700">{saveCount}</span>
        </button>
      </div>

      {/* Post Details / Caption */}
      <div className="px-5 pb-2">
        <div className="space-y-1">
          {post.caption && (
            <p className="text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
              <span className="font-bold text-slate-900 mr-2">@{post.creator_profile_username}</span>
              {post.caption}
            </p>
          )}

          {/* Category / Skills talent chips */}
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {post.category_name && (
              <span className="px-2.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                {post.category_name}
              </span>
            )}
            {post.post_type === 'listing_showcase' && (
              <span className="px-2.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-0.5">
                ● Showcase
              </span>
            )}
          </div>

          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block pt-1">
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>

      {/* CTA Footer Row (View Profile, Message, Custom Order) or Owner Controls */}
      {isOwner ? (
        <div className="px-5 py-3.5 border-t border-slate-50 bg-slate-50/45 flex flex-wrap gap-2.5 mt-auto">
          <Link
            href={creatorProfileUrl}
            className="flex-1 min-w-[100px] py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Profile
          </Link>
          <Link
            href="/dashboard/creator/posts"
            className="flex-1 min-w-[100px] py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            Manage Posts
          </Link>
        </div>
      ) : (
        <div className="px-5 py-3.5 border-t border-slate-50 bg-slate-50/45 flex flex-wrap gap-2.5 mt-auto">
          <Link
            href={creatorProfileUrl}
            className="flex-1 min-w-[100px] py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Profile
          </Link>
          <button
            onClick={() => {
              if (isAnonymous) handleAuthRedirect();
              else router.push(`/messages?creator=${post.creator_profile_id}`);
            }}
            className="flex-1 min-w-[100px] py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </button>
          <button
            onClick={() => {
              if (isAnonymous) handleAuthRedirect();
              else router.push(`${creatorProfileUrl}#custom-order-panel`);
            }}
            className="flex-1 min-w-[120px] py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
            Request Custom Order
          </button>
        </div>
      )}

      {/* Comments Drawer / Section */}
      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 animate-slideDown flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Comments ({commentsCount})
            </span>
          </div>

          {/* Comments List */}
          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto no-scrollbar pr-1">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-medium gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                No comments yet. Be the first to say something!
              </div>
            ) : (
              comments.map((comment) => {
                const isCommentOwner = comment.profile_id === viewerProfileId;
                const canDelete = isCommentOwner || isOwner;

                return (
                  <div key={comment.id} className="flex gap-2.5 items-start text-xs group/comment">
                    <div className="relative w-7 h-7 rounded-full overflow-hidden border border-slate-200 bg-slate-200 flex-shrink-0">
                      {comment.avatar_url ? (
                        <Image
                          src={comment.avatar_url}
                          alt={comment.display_name ?? ''}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-550 font-bold bg-slate-100 text-[10px]">
                          {comment.display_name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-white border border-slate-100 px-3 py-2 rounded-2xl shadow-sm relative min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-slate-800">
                          {comment.display_name ?? comment.username}
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold">
                          {timeAgo(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-655 leading-relaxed break-words">{comment.body}</p>
                    </div>

                    {/* Delete comment action */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-slate-400 hover:text-rose-600 transition self-center p-1 opacity-0 group-hover/comment:opacity-100 focus:opacity-100"
                        title="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Comment Input Form */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder={isAnonymous ? "Log in to add a comment..." : "Write a comment..."}
              disabled={isAnonymous || commentSubmitting}
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              maxLength={500}
              className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={!newCommentBody.trim() || commentSubmitting || isAnonymous}
              className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white transition flex-shrink-0 shadow-sm"
              title="Post comment"
            >
              {commentSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
