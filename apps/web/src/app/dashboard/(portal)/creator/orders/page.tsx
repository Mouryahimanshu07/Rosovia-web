import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCreatorOrdersForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { OrderCard } from '~/components/order/order-card';
import { OrderActions } from '~/components/order/order-actions';

export const metadata: Metadata = {
  title: 'Creator Orders — Rosovia',
  description: 'Manage orders assigned to you as a creator.',
};

export default async function CreatorOrdersPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/buyer/orders');

  const orders = await listCreatorOrdersForCurrentUser(supabase);

  return (
    <DashboardShell
      title="Creator Orders"
      description="Orders assigned to you. Update status as you fulfill them."
    >
      {orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm font-medium text-gray-700">No orders yet</p>
          <p className="text-xs text-gray-500 mt-1">
            When buyers order your listings or accept custom order quotes, they will appear here.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <a
              href="/dashboard/creator/listings"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Manage Listings
            </a>
            <a
              href="/dashboard/creator/custom-orders"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Custom Orders
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              viewAs="creator"
              actions={
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <OrderActions
                    orderId={order.id}
                    orderStatus={order.order_status}
                    paymentStatus={order.payment_status}
                    viewAs="creator"
                  />
                  <a
                    href={`/dashboard/creator/orders/${order.id}`}
                    className="text-xs text-indigo-600 hover:underline ml-auto"
                  >
                    View details →
                  </a>
                </div>
              }
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
