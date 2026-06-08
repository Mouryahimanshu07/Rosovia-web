'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Eye, Heart, Package, CheckCircle2, MessageCircle, Trash2, Loader2, X } from 'lucide-react';
import type { CreatorPostWithDetails } from '@rosovia/core';

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

interface CreatorPostCardProps {
  post: CreatorPostWithDetails;
  /** If true, shows creator info row (used in work feed) */
  showCreator?: boolean;
  isOwnDashboard?: boolean;
  onDelete?: (postId: string) => void;
}

export function CreatorPostCard({
  post,
  showCreator = true,
  isOwnDashboard = false,
  onDelete,
}: CreatorPostCardProps) {
  const firstMedia = post.media[0];
  const isVideo = firstMedia?.media_type === 'video' || firstMedia?.mime_type.startsWith('video/');
  const hasMultiple = post.media.length > 1;
  const relativeTime = timeAgo(post.created_at);
  const creatorProfileUrl = post.creator_profile_username
    ? `/u/${post.creator_profile_username}`
    : post.creator_slug
      ? `/creators/${post.creator_slug}`
      : '#';

  const [isDeleting, setIsDeleting] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Delete this post? This action will remove it from your public profile.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { deletePostAction } = await import('~/app/actions/posts');
      const result = await deletePostAction(post.id);
      if (result.success) {
        onDelete?.(post.id);
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('An unexpected error occurred while deleting the post.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <article className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 flex flex-col">
        {/* Media Thumbnail */}
        <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden flex-shrink-0">
          {/* Moderation Status Badge */}
          {isOwnDashboard && (
            <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
              {post.moderation_status === 'approved' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white shadow-sm border border-emerald-400/20">
                  ● Live
                </span>
              )}
              {post.moderation_status === 'rejected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white shadow-sm border border-red-400/20">
                  ● Rejected
                </span>
              )}
              {post.moderation_status === 'hidden' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-600/90 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white shadow-sm border border-gray-500/20">
                  ● Hidden
                </span>
              )}
            </div>
          )}

          {firstMedia ? (
            <div className="w-full h-full relative cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
              {isVideo ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                  {firstMedia.thumbnail_url ? (
                    <Image
                      src={firstMedia.thumbnail_url}
                      alt={post.caption ?? 'Work post'}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                      unoptimized
                    />
                  ) : (
                    <video
                      src={firstMedia.public_url ?? ''}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/25 transition-colors duration-300">
                    <div className="w-12 h-12 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Play className="h-5 w-5 text-gray-900 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <Image
                  src={firstMedia.public_url ?? ''}
                  alt={post.caption ?? 'Work post'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized
                />
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
              <span className="text-4xl">🎨</span>
            </div>
          )}

          {/* Carousel indicator */}
          {hasMultiple && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
              1 / {post.media.length}
            </div>
          )}

          {/* Post type badge */}
          {post.post_type === 'listing_showcase' && post.listing_id && (
            <div className="absolute bottom-2 left-2 bg-indigo-600/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
              <Package className="h-3 w-3" />
              Listing
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3 flex-1">
          {/* Creator row */}
          {showCreator && (post.creator_slug || post.creator_profile_username) && (
            <Link
              href={creatorProfileUrl}
              className="flex items-center gap-2 group/creator"
            >
              <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-100 overflow-hidden flex-shrink-0 relative">
                {post.creator_profile_image_url ? (
                  <Image
                    src={post.creator_profile_image_url}
                    alt={post.creator_display_name ?? ''}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-indigo-400">
                    {post.creator_display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800 truncate group-hover/creator:text-indigo-600 transition-colors">
                  {post.creator_display_name}
                </span>
                {post.creator_is_verified && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                )}
              </div>
            </Link>
          )}

          {/* Caption */}
          {post.caption && (
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{post.caption}</p>
          )}

          {/* Linked Listing Showcase Card */}
          {post.post_type === 'listing_showcase' && post.listing && (
            <Link
              href={`/listings/${post.listing.slug}`}
              className="mt-2 block p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/55 hover:border-indigo-200 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">
                    🏪 Showcasing Listing
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {post.listing.title}
                  </h4>
                </div>
                <div className="flex-shrink-0 text-right">
                  {post.listing.price !== null ? (
                    <span className="text-xs font-bold text-indigo-700 bg-white border border-indigo-100 rounded-lg px-2.5 py-1 inline-block shadow-sm">
                      {post.listing.currency} {post.listing.price.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-xs italic text-gray-505 bg-white border border-gray-100 rounded-lg px-2.5 py-1 inline-block shadow-sm">
                      Price on Request
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* Moderation Info (Owner Only) — only shown for non-live states */}
          {isOwnDashboard && (post.moderation_status === 'rejected' || post.moderation_status === 'hidden') && (
            <div className="mt-2 space-y-1.5 rounded-xl text-xs">
              {post.moderation_status === 'rejected' && (
                <div className="text-red-850 border border-red-100 bg-red-50/50 p-2.5 rounded-xl space-y-2">
                  <span className="font-bold text-red-800 flex items-center gap-1">❌ Rejected</span>
                  {post.moderation_note && (
                    <div className="bg-white/95 p-2 rounded-lg border border-red-100 text-[10px] text-red-700 leading-relaxed font-mono">
                      <span className="font-bold text-gray-500 block uppercase tracking-wider text-[9px] mb-0.5">Admin Note:</span>
                      {post.moderation_note}
                    </div>
                  )}
                  <span className="text-[11px] block leading-relaxed text-red-600 font-medium">
                    rejected item can be edited and resubmitted
                  </span>
                </div>
              )}
              {post.moderation_status === 'hidden' && (
                <div className="text-gray-850 border border-gray-200 bg-gray-50 p-2.5 rounded-xl space-y-2">
                  <span className="font-bold text-gray-800 flex items-center gap-1">👁️ Hidden</span>
                  {post.moderation_note && (
                    <div className="bg-white/95 p-2 rounded-lg border border-gray-150 text-[10px] text-gray-750 leading-relaxed font-mono">
                      <span className="font-bold text-gray-500 block uppercase tracking-wider text-[9px] mb-0.5">Admin Note:</span>
                      {post.moderation_note}
                    </div>
                  )}
                  <span className="text-[11px] block leading-relaxed text-gray-500">
                    This post has been hidden by the admin.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Owner Dashboard Actions */}
          {isOwnDashboard ? (
            <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-gray-50 hover:bg-gray-105 border border-gray-200 text-xs font-bold text-gray-700 transition active:scale-95"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-red-55/10 hover:bg-red-50 border border-red-100 text-xs font-bold text-red-700 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Visitor Footer Row: stats + time */
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1" title="Views">
                  <Eye className="h-3.5 w-3.5" />
                  {post.view_count.toLocaleString()}
                </span>
                <span className="flex items-center gap-1" title="Likes">
                  <Heart className="h-3.5 w-3.5" />
                  {post.like_count.toLocaleString()}
                </span>
                <Link
                  href={`/dashboard/messages?creator=${post.creator_profile_id}`}
                  className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors ml-1"
                  title="Ask Creator about this"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Ask</span>
                </Link>
                <Link
                  href={`${creatorProfileUrl}#custom-order-panel`}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors ml-3 font-medium"
                  title="Commission a Custom Order"
                >
                  <span>🎨 Commission</span>
                </Link>
              </div>
              <span className="text-xs text-gray-400">{relativeTime}</span>
            </div>
          )}
        </div>
      </article>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-6 animate-fadeIn">
          {/* Close button */}
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all z-50 border border-white/10 shadow-lg"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Lightbox Card Container */}
          <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col md:flex-row max-h-[85vh] md:max-h-[80vh]">
            {/* Left: Media Area */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[450px] relative">
              {firstMedia ? (
                isVideo ? (
                  <video
                    src={firstMedia.public_url ?? ''}
                    controls
                    autoPlay
                    className="max-w-full max-h-[45vh] md:max-h-[75vh] object-contain"
                  />
                ) : (
                  <div className="w-full h-full min-h-[300px] md:min-h-[450px] relative">
                    <Image
                      src={firstMedia.public_url ?? ''}
                      alt={post.caption ?? 'Full size view'}
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                )
              ) : (
                <div className="w-full h-full min-h-[300px] md:min-h-[450px] flex items-center justify-center bg-gray-900 text-white/50 text-6xl">
                  🎨
                </div>
              )}
            </div>

            {/* Right: Info Sidebar */}
            <div className="w-full md:w-80 bg-white p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 overflow-y-auto">
              <div className="space-y-4">
                {/* Creator Profile Info */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 overflow-hidden flex-shrink-0 relative">
                    {post.creator_profile_image_url ? (
                      <Image
                        src={post.creator_profile_image_url}
                        alt={post.creator_display_name ?? ''}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-indigo-400">
                        {post.creator_display_name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {post.creator_display_name}
                    </p>
                    {post.creator_profile_username && (
                      <p className="text-xs text-gray-400 font-semibold">@{post.creator_profile_username}</p>
                    )}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Caption */}
                {post.caption ? (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{post.caption}</p>
                ) : (
                  <p className="text-sm italic text-gray-400">No caption provided.</p>
                )}
              </div>

              {/* Bottom Actions and Stats */}
              <div className="space-y-4 pt-4 border-t border-gray-100 mt-6 shrink-0">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {post.view_count.toLocaleString()} views
                  </span>
                  <span>{relativeTime}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-gray-150 hover:bg-gray-205 text-gray-700 text-xs font-bold text-center transition"
                  >
                    Close
                  </button>
                  {!isOwnDashboard && (
                    <Link
                      href={`${creatorProfileUrl}#custom-order-panel`}
                      onClick={() => setIsLightboxOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition shadow-sm"
                    >
                      Commission
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
