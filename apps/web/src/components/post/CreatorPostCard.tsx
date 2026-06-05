import Image from 'next/image';
import Link from 'next/link';
import { Play, Eye, Heart, Package, CheckCircle2, MessageCircle } from 'lucide-react';
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
}

export function CreatorPostCard({ post, showCreator = true }: CreatorPostCardProps) {
  const firstMedia = post.media[0];
  const isVideo = firstMedia?.media_type === 'video';
  const hasMultiple = post.media.length > 1;
  const relativeTime = timeAgo(post.created_at);

  return (
    <article className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 flex flex-col">
      {/* Media Thumbnail */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden flex-shrink-0">
        {firstMedia ? (
          <>
            {isVideo ? (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                {firstMedia.thumbnail_url ? (
                  <Image
                    src={firstMedia.thumbnail_url}
                    alt={post.caption ?? 'Work post'}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <Play className="h-6 w-6 text-gray-900 fill-current ml-0.5" />
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
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
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
        {showCreator && post.creator_slug && (
          <Link
            href={`/creators/${post.creator_slug}`}
            className="flex items-center gap-2 group/creator"
          >
            <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-100 overflow-hidden flex-shrink-0">
              {post.creator_profile_image_url ? (
                <Image
                  src={post.creator_profile_image_url}
                  alt={post.creator_display_name ?? ''}
                  width={28}
                  height={28}
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

        {/* Footer row: stats + time */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-55">
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
              href={`/creators/${post.creator_slug}#custom-order-panel`}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors ml-3 font-medium"
              title="Commission a Custom Order"
            >
              <span>🎨 Commission</span>
            </Link>
          </div>
          <span className="text-xs text-gray-400">{relativeTime}</span>
        </div>
      </div>
    </article>
  );
}
