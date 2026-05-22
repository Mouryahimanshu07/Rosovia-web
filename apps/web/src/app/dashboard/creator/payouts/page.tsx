import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile, listCreatorPayouts } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const metadata: Metadata = {
  title: 'Payouts & Earnings — Rosovia',
  description: 'Track your earnings, pending settlements, and payout history.',
};

export const dynamic = 'force-dynamic';

function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    processing: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20',
    paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    failed: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    on_hold: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
    cancelled: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-400/20',
  };
  return map[status] ?? 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-400/20';
}

function getProviderLabel(provider: string | null): string {
  if (!provider) return '—';
  const map: Record<string, string> = {
    manual: 'Manual Transfer',
    razorpayx: 'RazorpayX',
    bank_transfer: 'Bank Transfer',
  };
  return map[provider] ?? provider;
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

export default async function CreatorPayoutsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const creatorProfile = await getCurrentCreatorProfile(supabase);
  if (!creatorProfile) redirect('/dashboard/creator/profile/new');

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const statusParam = searchParams.status || undefined;

  // Fetch paginated payouts + aggregate stats in parallel
  const [payouts, statsResult] = await Promise.all([
    listCreatorPayouts(supabase, creatorProfile.id, {
      page,
      status: statusParam as any,
    }),
    supabase
      .from('creator_payouts')
      .select('amount, status, currency')
      .eq('creator_id', creatorProfile.id)
      .is('deleted_at', null),
  ]);

  const { data: statsData } = statsResult;

  const allPayouts = statsData ?? [];

  const totalPaid = allPayouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingSettlement = allPayouts
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + p.amount, 0);

  const onHoldFailed = allPayouts
    .filter((p) => p.status === 'on_hold' || p.status === 'failed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <DashboardShell
      title="Payouts & Earnings"
      description="View your active settlements, total earnings, and historical payouts."
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Earned
              </span>
              <span className="mt-2 text-3xl font-extrabold text-emerald-600 tracking-tight">
                {formatCurrency(totalPaid)}
              </span>
              <span className="mt-1 text-xs text-gray-400">
                Transferred successfully to your account
              </span>
            </div>
            <div className="absolute right-4 bottom-4 text-4xl opacity-10 font-bold select-none">
              💰
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pending Settlement
              </span>
              <span className="mt-2 text-3xl font-extrabold text-amber-600 tracking-tight">
                {formatCurrency(pendingSettlement)}
              </span>
              <span className="mt-1 text-xs text-gray-400">
                Awaiting clearance or in process
              </span>
            </div>
            <div className="absolute right-4 bottom-4 text-4xl opacity-10 font-bold select-none">
              ⏳
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Held / Failed
              </span>
              <span className="mt-2 text-3xl font-extrabold text-gray-700 tracking-tight">
                {formatCurrency(onHoldFailed)}
              </span>
              <span className="mt-1 text-xs text-gray-400">
                Requires action or review
              </span>
            </div>
            <div className="absolute right-4 bottom-4 text-4xl opacity-10 font-bold select-none">
              ⚠️
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { label: 'All Payouts', value: '' },
              { label: 'Pending', value: 'pending' },
              { label: 'Processing', value: 'processing' },
              { label: 'Paid', value: 'paid' },
              { label: 'On Hold', value: 'on_hold' },
              { label: 'Failed', value: 'failed' },
            ].map((tab) => {
              const isActive = (searchParams.status ?? '') === tab.value;
              return (
                <a
                  key={tab.label}
                  href={`/dashboard/creator/payouts?status=${tab.value}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>

          {/* Payouts Table */}
          {payouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <div className="text-4xl mb-3">💸</div>
              <h3 className="text-sm font-semibold text-gray-950">No payouts found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No payout transactions match your current selection. As orders are completed, settlements will be generated here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4 text-left">Payout ID</th>
                      <th className="px-6 py-4 text-left">Order ID</th>
                      <th className="px-6 py-4 text-left">Method</th>
                      <th className="px-6 py-4 text-left">Reference</th>
                      <th className="px-6 py-4 text-left">Amount</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-left">Initiated On</th>
                      <th className="px-6 py-4 text-left">Paid On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                          {payout.id.slice(0, 8)}…
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-indigo-600">
                          <a
                            href={`/dashboard/creator/orders/${payout.order_id}`}
                            className="hover:underline"
                          >
                            {payout.order_id.slice(0, 8)}…
                          </a>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium">
                          {getProviderLabel(payout.provider)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          {payout.provider_reference || '—'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {formatCurrency(payout.amount, payout.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusBadge(
                              payout.status
                            )}`}
                          >
                            {payout.status.replace('_', ' ')}
                          </span>
                          {payout.status === 'failed' && payout.failure_reason && (
                            <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={payout.failure_reason}>
                              {payout.failure_reason}
                            </p>
                          )}
                          {payout.admin_note && (
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[150px] truncate" title={payout.admin_note}>
                              Note: {payout.admin_note}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(payout.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {payout.paid_at ? (
                            new Date(payout.paid_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {payouts.length === 20 && (
            <div className="flex justify-end pt-4">
              <a
                href={`/dashboard/creator/payouts?page=${page + 1}${
                  searchParams.status ? `&status=${searchParams.status}` : ''
                }`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition"
              >
                Next page →
              </a>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
