import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listPaymentsForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';

export const metadata: Metadata = {
  title: 'Payments — Admin — Rosovia',
};

export default async function AdminPaymentsPage({
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
  const payments = await listPaymentsForAdmin(supabase, {
    status: searchParams.status,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Read-only payment records. Raw payload is not shown. No refund actions here.
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No payments found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Provider Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Webhook</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.order_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{p.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate">
                    {p.provider_order_id ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ₹{p.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 uppercase text-xs">{p.currency}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.webhook_received ? (
                      <span className="text-green-600 font-medium">Received</span>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/payments?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
