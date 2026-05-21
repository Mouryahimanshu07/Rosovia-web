import type { OrderStatusHistory, OrderStatus } from '@rosovia/core';

interface OrderStatusHistoryProps {
  history: OrderStatusHistory[];
}

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
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

const STATUS_ICONS: Partial<Record<OrderStatus, string>> = {
  draft:           '📄',
  requested:       '📋',
  accepted:        '✅',
  payment_pending: '💳',
  paid:            '💰',
  in_progress:     '🔧',
  shipped:         '📦',
  delivered:       '🏠',
  completed:       '🎉',
  cancelled:       '❌',
  disputed:        '⚠️',
  refunded:        '↩️',
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderStatusHistoryList({ history }: OrderStatusHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No status history available.</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-6 ml-3" aria-label="Order status history">
      {history.map((entry, index) => {
        const newLabel = STATUS_LABELS[entry.new_status as OrderStatus] ?? entry.new_status;
        const icon = STATUS_ICONS[entry.new_status as OrderStatus] ?? '•';
        const isLatest = index === history.length - 1;

        return (
          <li key={entry.id} className="ml-4">
            {/* Timeline dot */}
            <span
              className={`absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${
                isLatest ? 'bg-indigo-500' : 'bg-gray-300'
              }`}
              aria-hidden="true"
            />

            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-base leading-none" aria-hidden="true">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {entry.old_status
                    ? `${STATUS_LABELS[entry.old_status as OrderStatus] ?? entry.old_status} → ${newLabel}`
                    : newLabel}
                </p>
                {entry.note && (
                  <p className="text-xs text-gray-500 mt-0.5 italic">{entry.note}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(entry.created_at)}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
