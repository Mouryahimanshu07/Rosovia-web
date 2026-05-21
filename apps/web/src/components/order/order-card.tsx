import type { OrderWithDetails } from '@rosovia/core';
import { OrderStatusBadge } from './order-status-badge';
import { PaymentStatusBadge } from './payment-status-badge';

interface OrderCardProps {
  order: OrderWithDetails;
  viewAs: 'buyer' | 'creator';
  actions?: React.ReactNode;
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function OrderCard({ order, viewAs, actions }: OrderCardProps) {
  const isFromListing = order.listing_id !== null;
  const sourceLabel = isFromListing
    ? (order.listing_title ?? 'Listing order')
    : (order.custom_order_title ?? 'Custom order');
  const sourceIcon = isFromListing ? '🏷️' : '🎨';

  const counterpartyLabel =
    viewAs === 'buyer'
      ? order.creator_display_name ?? 'Creator'
      : order.buyer_full_name ?? order.buyer_username ?? 'Buyer';
  const counterpartyPrefix = viewAs === 'buyer' ? 'Creator' : 'Buyer';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Source + title row */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-base leading-none mt-0.5" aria-hidden="true">
            {sourceIcon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate" title={sourceLabel}>
              {sourceLabel}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {counterpartyPrefix}: {counterpartyLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OrderStatusBadge status={order.order_status} />
        </div>
      </div>

      {/* Amount + payment status */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-lg font-bold text-gray-900">
          {formatAmount(order.amount, order.currency)}
        </p>
        <PaymentStatusBadge status={order.payment_status} />
        {order.delivery_status && (
          <span className="text-xs text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
            📦 {order.delivery_status}
          </span>
        )}
      </div>

      {/* Order ID + date */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        <span className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
        <span>{formatDate(order.created_at)}</span>
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="border-t border-gray-100 pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}
