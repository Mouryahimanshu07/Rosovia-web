'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { buyerConfirmDeliveryAction } from '~/app/actions/deliveries';
import type { OrderDelivery, DeliveryStatus, DeliveryType } from '@rosovia/core';

interface FulfillmentDetailsCardProps {
  delivery: OrderDelivery;
  viewAs: 'buyer' | 'creator';
  orderStatus: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; icon: string; colorClass: string }> = {
  pending: { label: 'Awaiting Shipment', icon: '⏳', colorClass: 'bg-gray-50 text-gray-600 border-gray-200' },
  shipped: { label: 'Shipped / In Transit', icon: '🚚', colorClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivered: { label: 'Delivered', icon: '🎁', colorClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  buyer_confirmed: { label: 'Confirmed & Completed', icon: '✅', colorClass: 'bg-green-50 text-green-700 border-green-200' },
  disputed: { label: 'Under Dispute', icon: '⚖️', colorClass: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', icon: '❌', colorClass: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const TYPE_CONFIG: Record<DeliveryType, { label: string; icon: string }> = {
  courier: { label: 'Physical Courier', icon: '📦' },
  digital: { label: 'Digital Delivery', icon: '💻' },
  manual: { label: 'Manual / In-Person', icon: '🤝' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FulfillmentDetailsCard({ delivery, viewAs, orderStatus }: FulfillmentDetailsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const statusCfg = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.pending;
  const typeCfg = TYPE_CONFIG[delivery.delivery_type] ?? TYPE_CONFIG.manual;

  // Buyer can confirm only when order is 'delivered' and delivery status is 'delivered'
  const canBuyerConfirm =
    viewAs === 'buyer' &&
    delivery.status === 'delivered' &&
    orderStatus === 'delivered';

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await buyerConfirmDeliveryAction({ orderId: delivery.order_id });
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  // Check if the delivery note looks like a URL
  const isUrl = (str: string | null) => {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-lg">
            {statusCfg.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Fulfillment & Delivery</h3>
            <p className="text-xs text-gray-500">
              {typeCfg.icon} {typeCfg.label}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusCfg.colorClass}`}>
          {statusCfg.icon} {statusCfg.label}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Timeline */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {delivery.shipped_at && (
            <div className="rounded-lg bg-purple-50 border border-purple-100 p-3">
              <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Shipped At</p>
              <p className="text-xs font-medium text-gray-700">{formatDate(delivery.shipped_at)}</p>
            </div>
          )}
          {delivery.delivered_at && (
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-3">
              <p className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mb-1">Delivered At</p>
              <p className="text-xs font-medium text-gray-700">{formatDate(delivery.delivered_at)}</p>
            </div>
          )}
          {delivery.buyer_confirmed_at && (
            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
              <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">Confirmed At</p>
              <p className="text-xs font-medium text-gray-700">{formatDate(delivery.buyer_confirmed_at)}</p>
            </div>
          )}
        </div>

        {/* Tracking reference */}
        {delivery.tracking_reference && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Tracking Reference</p>
            <p className="text-sm font-mono font-semibold text-indigo-800">{delivery.tracking_reference}</p>
          </div>
        )}

        {/* Delivery note / Access link */}
        {delivery.delivery_note && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              {delivery.delivery_type === 'digital' ? '🔗 Access Link / Delivery Note' : '📋 Delivery Note'}
            </p>
            {isUrl(delivery.delivery_note) ? (
              <a
                href={delivery.delivery_note}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline break-all transition"
              >
                <span>🔗</span>
                {delivery.delivery_note}
              </a>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{delivery.delivery_note}</p>
            )}
          </div>
        )}

        {/* Buyer Confirm Delivery CTA */}
        {canBuyerConfirm && (
          <div className="rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-green-800">Your order has been delivered! 🎉</h4>
              <p className="text-xs text-green-700 mt-1">
                Please review what was delivered and confirm receipt to release payment to the creator. Once confirmed, the order will be marked complete.
              </p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 transition"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Confirming…
                </>
              ) : (
                <>✅ Confirm Delivery & Complete Order</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
