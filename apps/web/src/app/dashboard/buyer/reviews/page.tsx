import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listBuyerReviewsForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ReviewList } from '~/components/review/review-list';
import { RatingDisplay } from '~/components/review/rating-display';

export const metadata: Metadata = {
  title: 'My Reviews — Rosovia',
  description: 'Reviews you have submitted on Rosovia.',
};

export default async function BuyerReviewsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const reviews = await listBuyerReviewsForCurrentUser(supabase);

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

  return (
    <DashboardShell
      title="My Reviews"
      description="Reviews you have submitted for completed orders."
    >
      <div className="space-y-6">
        {/* Summary card */}
        {totalReviews > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-5">
            <div className="text-3xl" aria-hidden="true">⭐</div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Your review activity</p>
              <RatingDisplay avg={avgRating} count={totalReviews} />
            </div>
          </div>
        )}

        <ReviewList
          reviews={reviews}
          viewAs="buyer"
          emptyMessage="You haven't submitted any reviews yet. Complete a paid order to leave a review."
          emptyIcon="⭐"
        />

        {totalReviews > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Reviews can be submitted once for each completed, paid order.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
