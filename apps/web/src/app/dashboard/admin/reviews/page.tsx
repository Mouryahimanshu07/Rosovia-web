import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listReviewsForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';
import { ReviewModerationActions } from '~/components/admin/review-moderation-actions';

export const metadata: Metadata = {
  title: 'Reviews — Admin — Rosovia',
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const reviews = await listReviewsForAdmin(supabase, {
    status: searchParams.status,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">Moderate buyer reviews. Hide or restore visibility.</p>
        </div>
        <div className="flex gap-2">
          {['', 'hidden', 'visible'].map((s) => (
            <a
              key={s}
              href={s ? `/dashboard/admin/reviews?status=${s}` : '/dashboard/admin/reviews'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                (searchParams.status ?? '') === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </a>
          ))}
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No reviews found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creator</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Listing</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visibility</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.is_hidden ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.buyer_display_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.creator_display_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate">
                    {r.listing_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {r.comment ?? <span className="italic text-gray-300">No comment</span>}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={r.is_hidden ? 'hidden' : 'visible'} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(r.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <ReviewModerationActions reviewId={r.id} isHidden={r.is_hidden} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviews.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/reviews?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
