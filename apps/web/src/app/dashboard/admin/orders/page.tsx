import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listOrdersForAdmin } from '@rosovia/api';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';

export const metadata: Metadata = {
  title: 'Orders — Admin — Rosovia',
};

export default async function AdminOrdersPage({
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
  const orders = await listOrdersForAdmin(supabase, {
    status: searchParams.status,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only order overview. No refund or payout actions here.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No orders found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creator</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.buyer_full_name ?? o.buyer_username ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.creator_display_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {o.listing_title ?? o.custom_order_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ₹{o.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={o.order_status} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={o.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orders.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/orders?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
