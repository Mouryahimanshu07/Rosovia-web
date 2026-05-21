import type { Payment } from '@rosovia/core';

interface PaymentStatusCardProps {
  payment: Payment | null;
  orderId: string;
}

const STATUS_CONFIG = {
  created: {
    label: 'Awaiting Payment',
    icon: '💳',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    desc: 'Payment has not been initiated yet.',
  },
  pending: {
    label: 'Payment Processing',
    icon: '⏳',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    desc: 'Your payment is being processed. This page will update automatically once confirmed.',
  },
  paid: {
    label: 'Payment Confirmed',
    icon: '✅',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    desc: 'Payment was successfully received. The creator will begin work soon.',
  },
  failed: {
    label: 'Payment Failed',
    icon: '❌',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    desc: 'Your last payment attempt failed. Please try again using the Pay Now button.',
  },
  refunded: {
    label: 'Refunded',
    icon: '↩️',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    desc: 'This payment has been refunded.',
  },
  partially_refunded: {
    label: 'Partially Refunded',
    icon: '↩️',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    desc: 'A partial refund has been issued.',
  },
  cancelled: {
    label: 'Cancelled',
    icon: '🚫',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    desc: 'This payment was cancelled.',
  },
} as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN')}`;
}

export function PaymentStatusCard({ payment, orderId }: PaymentStatusCardProps) {
  if (!payment) {
    const config = STATUS_CONFIG.created;
    return (
      <div className={`rounded-xl border ${config.border} ${config.bg} p-5`}>
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">{config.icon}</span>
          <div>
            <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusKey = payment.status as keyof typeof STATUS_CONFIG;
  const config = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.created;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5 space-y-3`}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
        </div>
        <p className={`text-sm font-bold ${config.text} flex-shrink-0`}>
          {formatAmount(payment.amount, payment.currency)}
        </p>
      </div>

      {/* Payment details */}
      <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-500">
        {payment.provider_payment_id && (
          <>
            <span className="font-medium">Payment ID</span>
            <span className="font-mono truncate">{payment.provider_payment_id}</span>
          </>
        )}
        {payment.provider_order_id && (
          <>
            <span className="font-medium">Provider Order</span>
            <span className="font-mono truncate">{payment.provider_order_id}</span>
          </>
        )}
        <span className="font-medium">Initiated</span>
        <span>{formatDate(payment.created_at)}</span>
        {payment.webhook_received && (
          <>
            <span className="font-medium">Confirmed via</span>
            <span>Razorpay webhook ✓</span>
          </>
        )}
      </div>

      {payment.status === 'pending' && (
        <p className="text-xs text-blue-600 italic">
          Payment confirmation is handled securely by Razorpay webhook.
          This page will update once your payment is verified.
        </p>
      )}
    </div>
  );
}
