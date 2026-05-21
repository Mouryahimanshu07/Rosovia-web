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
    <Link
      href={`/listings/${listing.slug}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-gray-300"
    >
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

        {/* Creator */}
        {listing.creator_display_name && (
          <p className="text-xs text-gray-500">by {listing.creator_display_name}</p>
        )}

        {/* Location */}
        {location && <p className="text-xs text-gray-400">{location}</p>}

        {/* Price */}
        <div className="flex items-center justify-between mt-1">
          {listing.price !== null ? (
            <span className="font-semibold text-gray-900 text-sm">
              {listing.currency} {listing.price.toLocaleString('en-IN')}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Price on request</span>
          )}
          {showStatus && (
            <span className="text-xs text-gray-500 capitalize">{listing.status.replace('_', ' ')}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
