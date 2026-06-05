import type { ReviewWithDetails } from '@rosovia/core';

interface ReviewCardProps {
  review: ReviewWithDetails;
  viewAs?: 'buyer' | 'creator' | 'public';
  showHiddenBadge?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function SubRating({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-amber-500 tracking-tight" aria-label={`${value} out of 5`}>
        {'★'.repeat(value)}{'☆'.repeat(5 - value)}
      </span>
    </div>
  );
}

export function ReviewCard({
  review,
  viewAs = 'public',
  showHiddenBadge = false,
}: ReviewCardProps) {
  const displayName =
    viewAs === 'buyer'
      ? review.creator_display_name ?? 'Creator'
      : review.buyer_display_name ?? 'Anonymous';

  const hasSubRatings =
    review.quality_rating !== null ||
    review.communication_rating !== null ||
    review.delivery_rating !== null;

  return (
    <div
      className={[
        'rounded-xl border bg-white p-5 space-y-3 transition-shadow hover:shadow-sm',
        review.is_hidden ? 'border-orange-200 bg-orange-50/40' : 'border-gray-200',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Who — shown differently per perspective */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            {review.order_id && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-150 shadow-xs uppercase tracking-wider">
                ✓ Verified Purchase
              </span>
            )}
          </div>

          {/* Source info */}
          <p className="text-xs text-gray-500 mt-1 truncate">
            {viewAs === 'buyer' && review.creator_slug ? (
              <a
                href={`/creators/${review.creator_slug}`}
                className="hover:underline text-indigo-600 font-semibold"
              >
                {review.creator_display_name ?? 'View creator'}
              </a>
            ) : review.listing_title ? (
              <>
                <span className="text-gray-400">for</span> <span className="font-medium text-gray-700">{review.listing_title}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Star rating */}
          <span
            className="text-amber-400 text-base tracking-tight"
            aria-label={`${review.rating} out of 5 stars`}
          >
            {renderStars(review.rating)}
          </span>
          <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
        </div>
      </div>

      {/* Sub-ratings breakdown */}
      {hasSubRatings && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
          <SubRating label="Quality" value={review.quality_rating} />
          <SubRating label="Communication" value={review.communication_rating} />
          <SubRating label="Delivery" value={review.delivery_rating} />
        </div>
      )}

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-650 leading-relaxed whitespace-pre-line bg-gray-50/40 p-3 rounded-lg border border-gray-50 italic">
          &ldquo;{review.comment}&rdquo;
        </p>
      )}

      {/* Hidden badge — shown to creator in dashboard or if explicitly requested */}
      {showHiddenBadge && review.is_hidden && (
        <div className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
          <span aria-hidden="true">⚠</span> Hidden from public
        </div>
      )}

      {/* Creator reply section */}
      {review.creator_reply && (
        <div className="rounded-xl border border-gray-150 bg-indigo-50/20 p-4 mt-3 ml-4 space-y-1 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1">
              💬 Reply from {review.creator_display_name ?? 'Creator'}
            </p>
            {review.creator_replied_at && (
              <span className="text-[10px] text-gray-400 font-medium">
                {formatDate(review.creator_replied_at)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-650 leading-relaxed italic">
            &ldquo;{review.creator_reply}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
