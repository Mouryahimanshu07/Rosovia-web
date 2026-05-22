import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listBuyerRefundRequests } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const metadata: Metadata = {
  title: 'Refund Requests — Rosovia',
  description: 'View your refund requests on Rosovia.',
};

export const dynamic = 'force-dynamic';

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    requested: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    approved: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    rejected: 'bg-red-50 text-red-700 ring-red-600/20',
    processed: 'bg-green-50 text-green-700 ring-green-600/20',
    failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    cancelled: 'bg-gray-50 text-gray-600 ring-gray-400/20',
  };
  return map[status] ?? 'bg-gray-50 text-gray-600 ring-gray-400/20';
}

function getReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    duplicate_payment: 'Duplicate Payment',
    wrong_item: 'Wrong Item Delivered',
    not_delivered: 'Not Delivered',
    poor_quality: 'Poor Quality',
    creator_cancelled: 'Creator Cancelled',
    buyer_cancelled: 'Buyer Cancelled',
    fraud_suspected: 'Fraud Suspected',
    other: 'Other',
  };
  return map[reason] ?? reason;
}

export default async function BuyerRefundsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'buyer') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const refunds = await listBuyerRefundRequests(supabase, profile.id, {
    page,
    status: searchParams.status as any,
  });

  return (
    <DashboardShell
      title="Refund Requests"
      description="Track the status of your requested refunds."
    >
      <div className="space-y-6">
        {refunds.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <div className="text-4xl mb-4">💸</div>
            <h3 className="text-sm font-semibold text-gray-900">No refund requests</h3>
            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
              If you have issues with a payment or custom order, you can request a refund directly from the order page.
            </p>
            <div className="mt-5">
              <a
                href="/dashboard/buyer/orders"
                className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition"
              >
                Go to My Orders
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4 text-left">Refund ID</th>
                    <th className="px-6 py-4 text-left">Order ID</th>
                    <th className="px-6 py-4 text-left">Reason</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Requested On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {refund.id.slice(0, 8)}…
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-600">
                        <a href={`/dashboard/buyer/orders/${refund.order_id}`} className="hover:underline">
                          {refund.order_id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {getReasonLabel(refund.reason)}
                        </div>
                        {refund.description && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                            {refund.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {refund.currency} {refund.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${getStatusColor(refund.status)}`}>
                          {refund.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(refund.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {refunds.length === 20 && (
          <div className="flex justify-end pt-4">
            <a
              href={`/dashboard/buyer/refunds?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition"
            >
              Next page →
            </a>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
