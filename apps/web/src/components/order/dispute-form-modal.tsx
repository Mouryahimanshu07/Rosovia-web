'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createDisputeAction } from '~/app/actions/disputes';
import { DISPUTE_REASONS } from '@rosovia/core';
import type { DisputeReason } from '@rosovia/core';

interface DisputeFormModalProps {
  orderId: string;
  onClose: () => void;
}

const REASON_LABELS: Record<DisputeReason, { label: string; icon: string }> = {
  not_delivered: { label: 'Not Delivered', icon: '📦' },
  late_delivery: { label: 'Late Delivery', icon: '⏰' },
  quality_issue: { label: 'Quality Issue', icon: '⚠️' },
  wrong_item: { label: 'Wrong Item / Service', icon: '❌' },
  payment_issue: { label: 'Payment Issue', icon: '💳' },
  miscommunication: { label: 'Miscommunication', icon: '💬' },
  fraud_suspected: { label: 'Fraud Suspected', icon: '🚨' },
  abusive_behavior: { label: 'Abusive Behavior', icon: '🛡️' },
  other: { label: 'Other', icon: '📝' },
};

export function DisputeFormModal({ orderId, onClose }: DisputeFormModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [reason, setReason] = React.useState<DisputeReason | ''>('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError('Please select a dispute reason.');
      return;
    }

    startTransition(async () => {
      const result = await createDisputeAction({
        orderId,
        reason: reason as DisputeReason,
        description: description.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSubmitted(true);
        router.refresh();
        // Auto-close after a brief success display
        setTimeout(onClose, 2200);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-rose-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-xl">
                ⚖️
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Raise a Dispute</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  This will freeze the order and escalate to Rosovia support.
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

        {submitted ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-base font-bold text-gray-900">Dispute Raised Successfully</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              Your dispute has been logged. Rosovia support will review and respond to you via email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Info banner */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <strong>Before raising a dispute</strong>, please try to resolve the issue directly with the creator via the Messages inbox. Disputes are escalated to Rosovia support and may affect the order timeline.
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* Reason selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Dispute Reason <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(DISPUTE_REASONS as readonly DisputeReason[]).map((r) => {
                  const { label, icon } = REASON_LABELS[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                        reason === r
                          ? 'border-red-400 bg-red-50 ring-1 ring-red-400'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{icon}</span>
                      <span className={`text-xs font-medium ${reason === r ? 'text-red-700' : 'text-gray-700'}`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="dispute-description" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="dispute-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail. Include any evidence, dates, or relevant context that will help support resolve this quickly."
                rows={4}
                maxLength={3000}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none disabled:opacity-60 transition resize-none"
              />
              <p className="mt-1 text-[11px] text-gray-400 text-right">{description.length}/3000</p>
            </div>

            {/* Actions */}
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
                disabled={isPending || !reason}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 transition"
              >
                {isPending ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>⚖️ Submit Dispute</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
