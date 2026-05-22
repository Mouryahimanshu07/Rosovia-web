import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listBuyerOrdersForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { OrderCard } from '~/components/order/order-card';
import { OrderActions } from '~/components/order/order-actions';
import { PayNowButton } from '~/components/payment/pay-now-button';

export const metadata: Metadata = {
  title: 'My Orders — Rosovia',
  description: 'View and manage your orders on Rosovia.',
};

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN')}`;
}

export default async function BuyerOrdersPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const orders = await listBuyerOrdersForCurrentUser(supabase);


  return (
    <DashboardShell
      title="My Orders"
      description="Orders you have placed on Rosovia."
    >
      {orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">🛒</div>
          <p className="text-sm font-medium text-gray-700">No orders yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Browse listings or request a custom order to get started.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <a
              href="/listings"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Browse Listings
            </a>
            <a
              href="/dashboard/buyer/custom-orders"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              My Custom Orders
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isPayable =
              order.order_status === 'payment_pending' &&
              ['created', 'pending', 'failed'].includes(order.payment_status) &&
              order.amount > 0;

            return (
              <OrderCard
                key={order.id}
                order={order}
                viewAs="buyer"
                actions={
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPayable && (
                      <PayNowButton
                        orderId={order.id}
                        amountDisplay={formatAmount(order.amount, order.currency)}
                      />
                    )}
                    <OrderActions
                      orderId={order.id}
                      orderStatus={order.order_status}
                      paymentStatus={order.payment_status}
                      viewAs="buyer"
                    />
                    <a
                      href={`/dashboard/buyer/orders/${order.id}`}
                      className="text-xs text-indigo-600 hover:underline ml-auto"
                    >
                      View details →
                    </a>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
