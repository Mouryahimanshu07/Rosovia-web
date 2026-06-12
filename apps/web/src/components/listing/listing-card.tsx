import Link from 'next/link';
import type { ListingWithDetails } from '@rosovia/core';
import { ListingTypeBadge } from './listing-type-badge';

interface ListingCardProps {
  listing: ListingWithDetails;
  /** Show status badge — used in dashboard mode */
  showStatus?: boolean;
}

export function ListingCard({ listing, showStatus = false }: ListingCardProps) {
  const location = [listing.city, listing.state].filter(Boolean).join(', ');

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-gray-350 justify-between">
      <Link href={`/listings/${listing.slug}`} className="flex-1 space-y-2 block">
        {/* Placeholder header for cover image (Module 6) */}
        <div className="w-full h-32 rounded-lg bg-gray-50 border border-gray-100 mb-4 flex items-center justify-center text-gray-300 text-sm">
          No image yet
        </div>

        <div className="space-y-2">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <ListingTypeBadge type={listing.listing_type} />
            {listing.category_name && (
              <span className="text-xs text-gray-400">{listing.category_name}</span>
            )}
          </div>

          {/* Title */}
          <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
            {listing.title}
          </p>

          {/* Creator and ratings */}
          {listing.creator_display_name && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate">by {listing.creator_display_name}</span>
                {listing.creator_verification_level && listing.creator_verification_level !== 'none' && (
                  <span className="text-blue-500 flex-shrink-0" title="Verified Creator" aria-label="Verified Creator">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              {listing.creator_rating_count && listing.creator_rating_count > 0 ? (
                <div className="flex items-center gap-0.5 text-gray-700 font-semibold ml-2">
                  <span className="text-amber-500 text-sm leading-none">★</span>
                  <span>{listing.creator_rating_avg?.toFixed(1)}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Location */}
          {location && <p className="text-xs text-gray-400">{location}</p>}
        </div>
      </Link>

      {/* Footer row: price + message/ask button */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="flex flex-col">
          {listing.price !== null ? (
            <span className="font-bold text-gray-900 text-sm">
              {listing.currency} {listing.price.toLocaleString('en-IN')}
            </span>
          ) : (
            <span className="text-xs text-gray-450 italic">Price on request</span>
          )}
          {showStatus && (
            <span className="text-[10px] text-gray-400 capitalize mt-0.5">{listing.status.replace('_', ' ')}</span>
          )}
        </div>

        <Link
          href={`/messages?creator=${listing.creator_id}`}
          className="text-xs font-semibold bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded px-2.5 py-1.5 transition-all"
        >
          Ask Creator
        </Link>
      </div>
    </div>
  );
}
