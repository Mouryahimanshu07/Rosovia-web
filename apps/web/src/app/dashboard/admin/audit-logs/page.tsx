import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listAdminActionLogsForAdmin } from '@rosovia/api';

export const metadata: Metadata = {
  title: 'Audit Logs — Admin — Rosovia',
};

const ACTION_TYPES = [
  '',
  'user_suspended', 'user_unsuspended',
  'listing_approved', 'listing_rejected', 'listing_suspended',
  'review_hidden', 'review_unhidden',
  'category_created', 'category_updated',
  'report_resolved', 'report_rejected',
  'verification_reviewed',
];

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: { actionType?: string; targetType?: string; page?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const logs = await listAdminActionLogsForAdmin(supabase, {
    actionType: searchParams.actionType,
    targetType: searchParams.targetType,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable record of all admin moderation actions. Read-only.
          </p>
        </div>
        {/* Action type filter */}
        <div className="flex flex-wrap gap-1.5">
          {ACTION_TYPES.slice(0, 7).map((a) => (
            <a
              key={a}
              href={a ? `/dashboard/admin/audit-logs?actionType=${a}` : '/dashboard/admin/audit-logs'}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                (searchParams.actionType ?? '') === a
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {a ? a.replace(/_/g, ' ') : 'All'}
            </a>
          ))}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No audit log entries found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{log.admin_name ?? <span className="text-gray-400 italic">System</span>}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                      {log.action_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{log.target_type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.target_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {log.note ?? <span className="italic text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/audit-logs?page=${page + 1}${searchParams.actionType ? `&actionType=${searchParams.actionType}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
