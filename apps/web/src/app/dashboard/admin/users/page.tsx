import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listUsersForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';
import { UserStatusActions } from '~/components/admin/user-status-actions';

export const metadata: Metadata = {
  title: 'Users — Admin — Rosovia',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { status?: string; role?: string; page?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const users = await listUsersForAdmin(supabase, {
    status: searchParams.status,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage platform user accounts.</p>
        </div>
        {/* Status filter */}
        <div className="flex gap-2">
          {['', 'active', 'suspended'].map((s) => (
            <a
              key={s}
              href={s ? `/dashboard/admin/users?status=${s}` : '/dashboard/admin/users'}
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

      {users.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No users found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.full_name ?? '—'}</div>
                    <div className="text-xs text-gray-400">@{u.username ?? u.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {[u.city, u.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusActions
                      profileId={u.id}
                      currentStatus={u.status}
                      isSelf={u.id === profile.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {users.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/users?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
