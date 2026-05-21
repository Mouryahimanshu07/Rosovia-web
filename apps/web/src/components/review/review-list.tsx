import type { ReviewWithDetails } from '@rosovia/core';
import { ReviewCard } from './review-card';

interface ReviewListProps {
  reviews: ReviewWithDetails[];
  viewAs?: 'buyer' | 'creator' | 'public';
  showHiddenBadge?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
}

export function ReviewList({
  reviews,
  viewAs = 'public',
  showHiddenBadge = false,
  emptyMessage = 'No reviews yet.',
  emptyIcon = '⭐',
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <div className="text-3xl mb-3" aria-hidden="true">{emptyIcon}</div>
        <p className="text-sm font-medium text-gray-700">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          viewAs={viewAs}
          showHiddenBadge={showHiddenBadge}
        />
      ))}
    </div>
  );
}
