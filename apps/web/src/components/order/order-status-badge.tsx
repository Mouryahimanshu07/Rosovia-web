import type { OrderStatus } from '@rosovia/core';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft:           'bg-gray-100 text-gray-600 border-gray-200',
  requested:       'bg-blue-50 text-blue-700 border-blue-200',
  accepted:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  payment_pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid:            'bg-green-100 text-green-800 border-green-300',
  in_progress:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  shipped:         'bg-purple-50 text-purple-700 border-purple-200',
  delivered:       'bg-teal-50 text-teal-700 border-teal-200',
  completed:       'bg-green-50 text-green-700 border-green-200',
  cancelled:       'bg-red-50 text-red-600 border-red-200',
  disputed:        'bg-orange-50 text-orange-700 border-orange-200',
  refunded:        'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:           'Draft',
  requested:       'Requested',
  accepted:        'Accepted',
  payment_pending: 'Payment Pending',
  paid:            'Paid',
  in_progress:     'In Progress',
  shipped:         'Shipped',
  delivered:       'Delivered',
  completed:       'Completed',
  cancelled:       'Cancelled',
  disputed:        'Disputed',
  refunded:        'Refunded',
};

export function OrderStatusBadge({ status, className = '' }: OrderStatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles} ${className}`}
      aria-label={`Order status: ${label}`}
    >
      {label}
    </span>
  );
}
