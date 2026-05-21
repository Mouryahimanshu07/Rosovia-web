import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  getCurrentUserOrderDetail,
  listOrderStatusHistory,
  getPaymentByOrderId,
  getReviewByOrderId,
} from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { OrderStatusBadge } from '~/components/order/order-status-badge';
import { PaymentStatusBadge } from '~/components/order/payment-status-badge';
import { OrderActions } from '~/components/order/order-actions';
import { OrderStatusHistoryList } from '~/components/order/order-status-history';
import { PayNowButton } from '~/components/payment/pay-now-button';
import { PaymentStatusCard } from '~/components/payment/payment-status-card';
import { ReviewForm } from '~/components/review/review-form';
import { ReviewCard } from '~/components/review/review-card';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Order #${params.id.slice(0, 8).toUpperCase()} — Rosovia`,
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

export default async function BuyerOrderDetailPage({ params }: Props) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const order = await getCurrentUserOrderDetail(supabase, params.id);
  if (!order) notFound();

  // Buyers can only see their own orders on this route
  if (order.buyer_id !== profile.id) notFound();

  const [history, payment, existingReview] = await Promise.all([
    listOrderStatusHistory(supabase, order.id),
    getPaymentByOrderId(supabase, order.id),
    getReviewByOrderId(supabase, order.id),
  ]);

  // Review eligibility
  const isReviewEligible =
    order.order_status === 'completed' &&
    order.payment_status === 'paid';

  const sourceLabel = order.listing_id
    ? (order.listing_title ?? 'Listing order')
    : (order.custom_order_title ?? 'Custom order');

  const amountDisplay = formatAmount(order.amount, order.currency);

  // Show Pay Now when order is payable
  const isPayable =
    order.order_status === 'payment_pending' &&
    ['created', 'pending', 'failed'].includes(order.payment_status) &&
    order.amount > 0;

  return (
    <DashboardShell
      title={`Order #${order.id.slice(0, 8).toUpperCase()}`}
      description={`Details for your order placed on ${formatDate(order.created_at)}.`}
    >
      <div className="space-y-6">
        {/* Back link */}
        <a
          href="/dashboard/buyer/orders"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to My Orders
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
                Creator: {order.creator_display_name ?? '—'}
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
            <p className="text-2xl font-bold text-gray-900">{amountDisplay}</p>
            {order.platform_fee > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Platform fee: {formatAmount(order.platform_fee, order.currency)}
              </p>
            )}
          </div>

          {/* Pay Now — shown only when payable */}
          {isPayable && (
            <div className="mb-5">
              <PayNowButton orderId={order.id} amountDisplay={amountDisplay} />
              <p className="text-xs text-gray-400 mt-2">
                Payment confirmation is handled securely via Razorpay webhook.
              </p>
            </div>
          )}

          {/* Order Actions (cancel, complete, dispute) */}
          <OrderActions
            orderId={order.id}
            orderStatus={order.order_status}
            paymentStatus={order.payment_status}
            viewAs="buyer"
          />
        </div>

        {/* Payment status card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payment Status</h3>
          <PaymentStatusCard payment={payment} orderId={order.id} />
        </div>

        {/* Status history */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status History</h3>
          <OrderStatusHistoryList history={history} />
        </div>

        {/* Review section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Your Review</h3>
          {isReviewEligible ? (
            existingReview ? (
              <div className="space-y-3">
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  ✓ You have already submitted a review for this order.
                </p>
                <ReviewCard
                  review={{
                    ...existingReview,
                    buyer_display_name: null,
                    creator_display_name: order.creator_display_name,
                    creator_slug: order.creator_slug,
                    listing_title: order.listing_title,
                  }}
                  viewAs="buyer"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 mb-4">
                  Share your experience with this creator. Your review helps other buyers.
                </p>
                <ReviewForm orderId={order.id} />
              </div>
            )
          ) : (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              Reviews can only be submitted after an order is completed and paid.
            </p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
