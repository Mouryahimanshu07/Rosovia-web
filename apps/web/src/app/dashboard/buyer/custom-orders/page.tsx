import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listBuyerCustomOrdersForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { CustomOrderCard } from '~/components/custom-order/custom-order-card';
import { BuyerCustomOrderActions } from './buyer-custom-order-actions';
import { CreateCustomOrderButton } from '~/components/order/create-custom-order-button';

export const metadata: Metadata = {
  title: 'My Custom Orders — Rosovia',
};

export default async function BuyerCustomOrdersPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const orders = await listBuyerCustomOrdersForCurrentUser(supabase);

  return (
    <DashboardShell
      title="My Custom Orders"
      description="Custom order requests you have sent to creators."
    >
      {orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">🎨</div>
          <p className="text-sm font-medium text-gray-700">No custom orders yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Find a creator and request a custom order to get started.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <a
              href="/creators"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Browse Creators
            </a>
            <a
              href="/listings"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Browse Listings
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <CustomOrderCard
              key={order.id}
              order={order}
              viewAs="buyer"
              actions={
                <div className="flex items-center gap-3 flex-wrap">
                  <BuyerCustomOrderActions
                    customOrderId={order.id}
                    status={order.status}
                  />
                  {order.status === 'accepted' && (
                    <CreateCustomOrderButton customOrderId={order.id} />
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
