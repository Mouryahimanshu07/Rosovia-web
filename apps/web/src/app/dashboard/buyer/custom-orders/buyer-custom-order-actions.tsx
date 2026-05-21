'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptQuoteAction,
  cancelCustomOrderAsBuyerAction,
} from './actions';
import type { CustomOrderStatus } from '@rosovia/core';

interface BuyerCustomOrderActionsProps {
  customOrderId: string;
  status: CustomOrderStatus;
}

export function BuyerCustomOrderActions({
  customOrderId,
  status,
}: BuyerCustomOrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canAccept = status === 'quoted';
  const canCancel = ['requested', 'creator_reviewing', 'quoted'].includes(status);

  if (!canAccept && !canCancel) return null;

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
      {canAccept && (
        <button
          disabled={isPending}
          onClick={() => handle(acceptQuoteAction)}
          className="text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Accept Quote'}
        </button>
      )}
      {canCancel && (
        <button
          disabled={isPending}
          onClick={() => handle(cancelCustomOrderAsBuyerAction)}
          className="text-xs text-gray-500 hover:text-gray-900 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Cancel'}
        </button>
      )}
    </div>
  );
}
