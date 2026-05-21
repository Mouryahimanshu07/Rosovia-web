import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { getCurrentCreatorListingDashboardState } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ListingStatusBadge } from '~/components/listing/listing-status-badge';
import { ListingTypeBadge } from '~/components/listing/listing-type-badge';
import { ListingActions } from './listing-actions';

export default async function CreatorListingsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const { creatorProfile, listings } = await getCurrentCreatorListingDashboardState(supabase);

  if (!creatorProfile) {
    redirect('/dashboard/creator/profile');
  }

  return (
    <DashboardShell
      title="My Listings"
      description="Manage the products and services you offer on Rosovia."
    >
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex justify-end">
          <Link
            href="/dashboard/creator/listings/new"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
          >
            + Add Listing
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <div className="text-3xl mb-3">📦</div>
            <p className="text-sm font-medium text-gray-700">No listings yet</p>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              Create your first listing to start attracting buyers.
            </p>
            <Link
              href="/dashboard/creator/listings/new"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Create Listing
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                      {listing.title}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <ListingTypeBadge type={listing.listing_type} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {listing.category_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell">
                      {listing.price !== null
                        ? `${listing.currency} ${listing.price.toLocaleString('en-IN')}`
                        : <span className="text-gray-400 text-xs italic">On request</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <ListingStatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ListingActions listing={listing} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
