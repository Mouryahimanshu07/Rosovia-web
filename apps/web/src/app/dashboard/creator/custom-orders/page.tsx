import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCreatorCustomOrdersForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { CustomOrderCard } from '~/components/custom-order/custom-order-card';
import { CustomOrderQuoteForm } from '~/components/custom-order/custom-order-quote-form';
import { CreatorCustomOrderActions } from './creator-custom-order-actions';

export const metadata: Metadata = {
  title: 'Custom Orders — Creator Dashboard — Rosovia',
};

export default async function CreatorCustomOrdersPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect(`/dashboard/${profile.role}`);

  const orders = await listCreatorCustomOrdersForCurrentUser(supabase);

  return (
    <DashboardShell
      title="Custom Orders"
      description="Custom order requests from buyers assigned to you."
    >
      {orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm font-medium text-gray-700">No custom orders yet</p>
          <p className="text-xs text-gray-500 mt-1">
            When buyers send you custom order requests, they will appear here.
          </p>
          <div className="mt-4">
            <a
              href="/dashboard/creator/listings"
              className="text-xs text-indigo-600 hover:underline"
            >
              Make sure your listings have custom orders enabled →
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const canShowQuoteForm =
              ['requested', 'creator_reviewing'].includes(order.status) &&
              order.creator_quote_amount === null;

            return (
              <CustomOrderCard
                key={order.id}
                order={order}
                viewAs="creator"
                actions={
                  <div className="space-y-3">
                    {/* Status actions: Mark Reviewing / Reject / Cancel */}
                    <CreatorCustomOrderActions
                      customOrderId={order.id}
                      status={order.status}
                    />
                    {/* Quote form — only if quotable and no existing quote */}
                    {canShowQuoteForm && (
                      <CustomOrderQuoteForm customOrderId={order.id} />
                    )}
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
