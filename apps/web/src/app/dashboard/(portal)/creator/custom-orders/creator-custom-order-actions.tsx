'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  markReviewingAction,
  rejectCustomOrderAction,
  cancelCustomOrderAsCreatorAction,
} from './actions';
import type { CustomOrderStatus } from '@rosovia/core';

interface CreatorCustomOrderActionsProps {
  customOrderId: string;
  status: CustomOrderStatus;
}

export function CreatorCustomOrderActions({
  customOrderId,
  status,
}: CreatorCustomOrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canMarkReviewing = status === 'requested';
  const canReject = ['requested', 'creator_reviewing', 'quoted'].includes(status);
  const canCancel = ['requested', 'creator_reviewing', 'quoted'].includes(status);

  if (!canMarkReviewing && !canReject && !canCancel) return null;

  const handle = (
    action: (id: string) => Promise<{ success: boolean; error?: string }>
  ) => {
    startTransition(async () => {
      const result = await action(customOrderId);
      if (!result.success) {
        alert(result.error ?? 'Action failed');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {canMarkReviewing && (
        <button
          disabled={isPending}
          onClick={() => handle(markReviewingAction)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Mark as Reviewing'}
        </button>
      )}
      {canReject && (
        <button
          disabled={isPending}
          onClick={() => handle(rejectCustomOrderAction)}
          className="text-xs text-orange-500 hover:text-orange-700 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Reject'}
        </button>
      )}
      {canCancel && (
        <button
          disabled={isPending}
          onClick={() => handle(cancelCustomOrderAsCreatorAction)}
          className="text-xs text-gray-400 hover:text-gray-700 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Cancel'}
        </button>
      )}
    </div>
  );
}
