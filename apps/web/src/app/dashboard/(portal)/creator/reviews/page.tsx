import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  listCreatorReviewsForCurrentUser,
  getCreatorProfileByUserId,
} from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ReviewList } from '~/components/review/review-list';
import { RatingDisplay } from '~/components/review/rating-display';

export const metadata: Metadata = {
  title: 'My Reviews — Creator Dashboard — Rosovia',
  description: 'Reviews received from buyers on Rosovia.',
};

export default async function CreatorReviewsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/buyer');

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) redirect('/dashboard/creator/profile');

  const reviews = await listCreatorReviewsForCurrentUser(supabase);

  return (
    <DashboardShell
      title="Reviews Received"
      description="Reviews buyers have submitted for your completed orders."
    >
      <div className="space-y-6">
        {/* Rating summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-5">
          <div className="text-3xl" aria-hidden="true">⭐</div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Your rating summary</p>
            <RatingDisplay avg={creatorProfile.rating_avg} count={creatorProfile.rating_count} />
          </div>
        </div>

        <ReviewList
          reviews={reviews}
          viewAs="creator"
          showHiddenBadge={true}
          emptyMessage="You haven't received any reviews yet. Reviews appear here after a buyer completes and pays for an order."
          emptyIcon="⭐"
        />

        {reviews.some((r) => r.is_hidden) && (
          <p className="text-xs text-orange-600 text-center">
            Some reviews are hidden from your public profile. They will not affect your displayed rating.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
