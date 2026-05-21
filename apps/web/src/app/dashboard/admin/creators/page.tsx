import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCreatorsForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';

export const metadata: Metadata = {
  title: 'Creators — Admin — Rosovia',
};

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const creators = await listCreatorsForAdmin(supabase, { page, q: searchParams.q });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Creators</h1>
        <p className="text-sm text-gray-500 mt-0.5">View all creator profiles on the platform.</p>
      </div>

      {creators.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No creators found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Display Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Linked User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Verification</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creators.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.display_name}</div>
                    <div className="text-xs text-gray-400">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{c.linked_user_name ?? '—'}</div>
                    <div className="text-xs text-gray-400">{c.linked_user_email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={c.verification_level} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.rating_avg > 0 ? `${c.rating_avg.toFixed(1)} (${c.rating_count})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.linked_user_status && <AdminStatusBadge status={c.linked_user_status} />}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/creators/${c.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-500"
                    >
                      View Profile ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creators.length === 20 && (
        <div className="flex justify-end">
          <a href={`/dashboard/admin/creators?page=${page + 1}`} className="text-sm text-indigo-600 hover:text-indigo-500">
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
