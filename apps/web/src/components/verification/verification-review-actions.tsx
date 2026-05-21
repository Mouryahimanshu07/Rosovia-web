'use client';

import { useTransition, useState } from 'react';
import type { VerificationRequestWithDetails } from '@rosovia/core';

interface VerificationReviewActionsProps {
  request: VerificationRequestWithDetails;
  onComplete?: () => void;
}

export function VerificationReviewActions({ request, onComplete }: VerificationReviewActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [adminNote, setAdminNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ decision: 'approve' | 'reject' } | null>(null);

  if (request.status !== 'pending') {
    return (
      <p className="text-xs text-gray-400 italic">
        Already {request.status}.
      </p>
    );
  }

  if (done && result) {
    return (
      <p className={`text-sm font-medium ${result.decision === 'approve' ? 'text-green-700' : 'text-red-700'}`}>
        ✓ {result.decision === 'approve' ? 'Approved' : 'Rejected'} successfully.
      </p>
    );
  }

  const handleDecision = (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !adminNote.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const { reviewVerificationRequestAction } = await import(
        '~/app/dashboard/admin/verification/actions'
      );
      const res = await reviewVerificationRequestAction({
        verificationRequestId: request.id,
        decision,
        adminNote: adminNote.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setDone(true);
        setResult({ decision });
        onComplete?.();
      }
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`admin-note-${request.id}`}
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Admin Note{' '}
          <span className="text-gray-400 font-normal">(required for rejection, optional for approval)</span>
        </label>
        <textarea
          id={`admin-note-${request.id}`}
          rows={2}
          placeholder="Reason for decision…"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          disabled={isPending}
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          id={`approve-${request.id}`}
          disabled={isPending}
          onClick={() => handleDecision('approve')}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">✓</span>
          )}
          Approve
        </button>
        <button
          type="button"
          id={`reject-${request.id}`}
          disabled={isPending}
          onClick={() => handleDecision('reject')}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">✕</span>
          )}
          Reject
        </button>
      </div>
    </div>
  );
}
