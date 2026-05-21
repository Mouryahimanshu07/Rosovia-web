'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closeInquiryAsBuyerAction } from './actions';

export function BuyerInquiryActions({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    startTransition(async () => {
      const result = await closeInquiryAsBuyerAction(inquiryId);
      if (!result.success) {
        alert(result.error ?? 'Failed to close inquiry');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <button
      onClick={handleClose}
      disabled={isPending}
      className="text-xs text-gray-500 hover:text-gray-900 hover:underline disabled:opacity-50 transition"
    >
      {isPending ? 'Closing…' : 'Close inquiry'}
    </button>
  );
}
