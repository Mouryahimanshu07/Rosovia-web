import type { PaymentStatus } from '@rosovia/core';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  created:            'bg-gray-100 text-gray-600 border-gray-200',
  pending:            'bg-amber-50 text-amber-700 border-amber-200',
  paid:               'bg-green-100 text-green-800 border-green-300',
  failed:             'bg-red-50 text-red-600 border-red-200',
  refunded:           'bg-slate-100 text-slate-600 border-slate-200',
  partially_refunded: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  created:            'Awaiting Payment',
  pending:            'Payment Pending',
  paid:               'Paid',
  failed:             'Payment Failed',
  refunded:           'Refunded',
  partially_refunded: 'Partially Refunded',
};

export function PaymentStatusBadge({ status, className = '' }: PaymentStatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles} ${className}`}
      aria-label={`Payment status: ${label}`}
    >
      {label}
    </span>
  );
}
