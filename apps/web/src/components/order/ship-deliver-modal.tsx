'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { shipOrderAction, deliverOrderAction } from '~/app/actions/deliveries';
import type { DeliveryType } from '@rosovia/core';

interface ShipDeliverModalProps {
  orderId: string;
  mode: 'ship' | 'deliver';
  onClose: () => void;
}

const DELIVERY_TYPE_OPTIONS: { value: DeliveryType; label: string; icon: string; description: string }[] = [
  { value: 'courier', label: 'Courier / Shipping', icon: '🚚', description: 'Physical shipment with a tracking number.' },
  { value: 'digital', label: 'Digital Delivery', icon: '🔗', description: 'File, download link, or digital access.' },
  { value: 'manual', label: 'Manual / In-Person', icon: '🤝', description: 'Handed over directly or fulfilled offline.' },
];

export function ShipDeliverModal({ orderId, mode, onClose }: ShipDeliverModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [deliveryType, setDeliveryType] = React.useState<DeliveryType>('digital');
  const [trackingRef, setTrackingRef] = React.useState('');
  const [deliveryNote, setDeliveryNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const isShip = mode === 'ship';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let result;

      if (isShip) {
        result = await shipOrderAction({
          orderId,
          deliveryType,
          trackingReference: trackingRef.trim() || undefined,
          deliveryNote: deliveryNote.trim() || undefined,
        });
      } else {
        result = await deliverOrderAction({
          orderId,
          deliveryNote: deliveryNote.trim() || undefined,
        });
      }

      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className={`p-5 border-b border-gray-100 ${isShip ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-teal-50 to-emerald-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${isShip ? 'bg-purple-100' : 'bg-teal-100'}`}>
                {isShip ? '🚚' : '🎁'}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {isShip ? 'Mark as Shipped' : 'Mark as Delivered'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isShip ? 'Add shipping details for the buyer.' : 'Confirm delivery and notify the buyer.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Delivery Type — only for Ship mode */}
          {isShip && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Delivery Method
              </label>
              <div className="grid grid-cols-1 gap-2">
                {DELIVERY_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDeliveryType(option.value)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      deliveryType === option.value
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg mt-0.5">{option.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${deliveryType === option.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {option.label}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tracking Reference — only for courier in Ship mode */}
          {isShip && deliveryType === 'courier' && (
            <div>
              <label htmlFor="tracking-ref" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Tracking Number / Reference
              </label>
              <input
                id="tracking-ref"
                type="text"
                value={trackingRef}
                onChange={(e) => setTrackingRef(e.target.value)}
                placeholder="e.g. DTDC-12345678, BlueDart-ABC123"
                maxLength={200}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60 transition"
              />
            </div>
          )}

          {/* Delivery Note / Digital Link */}
          <div>
            <label htmlFor="delivery-note" className="block text-xs font-semibold text-gray-700 mb-1.5">
              {isShip && deliveryType === 'digital'
                ? 'Access Link or Download URL'
                : isShip
                ? 'Delivery Note (optional)'
                : 'Final Delivery Note or Access Link'}
            </label>
            <textarea
              id="delivery-note"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder={
                isShip && deliveryType === 'digital'
                  ? 'https://drive.google.com/... or any download/access link'
                  : 'Any message or instructions for the buyer...'
              }
              rows={3}
              maxLength={2000}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60 transition resize-none"
            />
            <p className="mt-1 text-[11px] text-gray-400 text-right">{deliveryNote.length}/2000</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition ${
                isShip
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-teal-600 hover:bg-teal-500'
              }`}
            >
              {isPending ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving…
                </>
              ) : (
                <>{isShip ? '🚚 Confirm Shipment' : '🎁 Confirm Delivery'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
