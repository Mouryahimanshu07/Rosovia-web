import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listListingsForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';
import { ListingModerationActions } from '~/components/admin/listing-moderation-actions';

export const metadata: Metadata = {
  title: 'Listings — Admin — Rosovia',
};

const STATUS_FILTERS = ['', 'pending_review', 'approved', 'rejected', 'suspended', 'draft', 'archived'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All',
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  draft: 'Draft',
  archived: 'Archived',
};

export default async function AdminListingsPage({
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
  const listings = await listListingsForAdmin(supabase, {
    listingStatus: searchParams.status as typeof listings[0]['status'] | undefined,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Listings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Approve, reject, or suspend marketplace listings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <a
              key={s}
              href={s ? `/dashboard/admin/listings?status=${s}` : '/dashboard/admin/listings'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                (searchParams.status ?? '') === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </a>
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No listings found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creator</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 max-w-xs truncate">{l.title}</div>
                    <a
                      href={`/listings/${l.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-500"
                    >
                      View ↗
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {l.creator_display_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.category_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{l.listing_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {l.price != null ? `₹${l.price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(l.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <ListingModerationActions listingId={l.id} currentStatus={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listings.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/listings?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
