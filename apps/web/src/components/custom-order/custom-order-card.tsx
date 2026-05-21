import type { CustomOrderWithDetails } from '@rosovia/core';
import { CustomOrderStatusBadge } from './custom-order-status-badge';

interface CustomOrderCardProps {
  order: CustomOrderWithDetails;
  viewAs: 'buyer' | 'creator';
  actions?: React.ReactNode;
}

function formatCurrency(amount: number | null) {
  if (amount === null) return null;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CustomOrderCard({ order, viewAs, actions }: CustomOrderCardProps) {
  const counterpartyName =
    viewAs === 'buyer'
      ? (order.creator_display_name ?? 'Unknown creator')
      : (order.buyer_full_name ?? order.buyer_username ?? 'Unknown buyer');

  const budgetDisplay =
    order.budget_min !== null || order.budget_max !== null
      ? [formatCurrency(order.budget_min), formatCurrency(order.budget_max)]
          .filter(Boolean)
          .join(' – ')
      : null;

  const deliveryLocation = [order.delivery_city, order.delivery_state]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{order.title}</p>
          <p className="text-xs text-gray-500">
            {viewAs === 'buyer' ? 'To: ' : 'From: '}
            <span className="font-medium text-gray-700">{counterpartyName}</span>
          </p>
          {order.listing_title && (
            <p className="text-xs text-indigo-600">Re: {order.listing_title}</p>
          )}
          {order.category_name && (
            <p className="text-xs text-gray-400">{order.category_name}</p>
          )}
        </div>
        <CustomOrderStatusBadge status={order.status} />
      </div>

      {/* Description */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-medium text-gray-500 mb-1">Requirements</p>
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
          {order.description}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {budgetDisplay && (
          <span>
            <span className="font-medium text-gray-700">Budget:</span> {budgetDisplay}
          </span>
        )}
        {order.deadline && (
          <span>
            <span className="font-medium text-gray-700">Deadline:</span>{' '}
            {formatDate(order.deadline)}
          </span>
        )}
        {deliveryLocation && (
          <span>
            <span className="font-medium text-gray-700">Delivery:</span> {deliveryLocation}
          </span>
        )}
        <span>
          <span className="font-medium text-gray-700">Sent:</span>{' '}
          {formatDate(order.created_at)}
        </span>
      </div>

      {/* Creator quote section */}
      {(order.creator_quote_amount !== null || order.creator_quote_note) && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-indigo-700">
            {viewAs === 'buyer' ? "Creator's Quote" : 'Your Quote'}
          </p>
          {order.creator_quote_amount !== null && (
            <p className="text-base font-bold text-indigo-900">
              {formatCurrency(order.creator_quote_amount)}
            </p>
          )}
          {order.creator_quote_note && (
            <p className="text-xs text-indigo-800 leading-relaxed whitespace-pre-line">
              {order.creator_quote_note}
            </p>
          )}
        </div>
      )}

      {/* Actions slot */}
      {actions && <div className="pt-1 border-t border-gray-100">{actions}</div>}
    </div>
  );
}
