import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  getCurrentUserOrderDetail,
  listOrderStatusHistory,
  getCreatorProfileByUserId,
  getPaymentByOrderId,
} from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { OrderStatusBadge } from '~/components/order/order-status-badge';
import { PaymentStatusBadge } from '~/components/order/payment-status-badge';
import { OrderActions } from '~/components/order/order-actions';
import { OrderStatusHistoryList } from '~/components/order/order-status-history';
import { PaymentStatusCard } from '~/components/payment/payment-status-card';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Order #${params.id.slice(0, 8).toUpperCase()} — Creator — Rosovia`,
  };
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function CreatorOrderDetailPage({ params }: Props) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/buyer/orders');

  // Resolve creator profile to verify ownership
  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) redirect('/dashboard/creator');

  const order = await getCurrentUserOrderDetail(supabase, params.id);
  if (!order) notFound();

  // Creator can only see their assigned orders on this route
  if (order.creator_id !== creatorProfile.id) notFound();

  const [history, payment] = await Promise.all([
    listOrderStatusHistory(supabase, order.id),
    getPaymentByOrderId(supabase, order.id),
  ]);

  const sourceLabel = order.listing_id
    ? (order.listing_title ?? 'Listing order')
    : (order.custom_order_title ?? 'Custom order');

  return (
    <DashboardShell
      title={`Order #${order.id.slice(0, 8).toUpperCase()}`}
      description={`Assigned order received on ${formatDate(order.created_at)}.`}
    >
      <div className="space-y-6">
        {/* Back link */}
        <a
          href="/dashboard/creator/orders"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Creator Orders
        </a>

        {/* Order overview card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                {order.listing_id ? 'Listing Order' : 'Custom Order'}
              </p>
              <h2 className="text-base font-semibold text-gray-900">{sourceLabel}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Buyer: {order.buyer_full_name ?? order.buyer_username ?? '—'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <OrderStatusBadge status={order.order_status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
          </div>

          {/* Amount */}
          <div className="bg-gray-50 rounded-lg p-4 mb-5">
            <p className="text-xs text-gray-500 mb-1">Order Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatAmount(order.amount, order.currency)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Your earnings: {formatAmount(order.seller_amount, order.currency)}
            </p>
          </div>

          {/* Creator note: cannot mark as paid */}
          {order.payment_status !== 'paid' && (
            <div className="mb-5 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-700">
                <strong>Waiting for buyer payment.</strong> You will be notified once the buyer
                completes payment. Payment is confirmed automatically via Razorpay.
              </p>
            </div>
          )}

          {/* Creator Actions */}
          <OrderActions
            orderId={order.id}
            orderStatus={order.order_status}
            paymentStatus={order.payment_status}
            viewAs="creator"
          />
        </div>

        {/* Payment status — read only for creator */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payment Status</h3>
          <PaymentStatusCard payment={payment} orderId={order.id} />
          <p className="text-xs text-gray-400 mt-3 italic">
            Only the buyer can initiate payment. Confirmation is processed securely by Razorpay.
          </p>
        </div>

        {/* Status history */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status History</h3>
          <OrderStatusHistoryList history={history} />
        </div>
      </div>
    </DashboardShell>
  );
}
