'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateInquiryStatusAction } from './actions';

interface CreatorInquiryActionsProps {
  inquiryId: string;
  canClose: boolean;
  canMarkSpam: boolean;
}

export function CreatorInquiryActions({
  inquiryId,
  canClose,
  canMarkSpam,
}: CreatorInquiryActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handle = (status: 'closed' | 'spam') => {
    startTransition(async () => {
      const result = await updateInquiryStatusAction(inquiryId, status);
      if (!result.success) {
        alert(result.error ?? 'Action failed');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {canClose && (
        <button
          disabled={isPending}
          onClick={() => handle('closed')}
          className="text-xs text-gray-500 hover:text-gray-900 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Close'}
        </button>
      )}
      {canMarkSpam && (
        <button
          disabled={isPending}
          onClick={() => handle('spam')}
          className="text-xs text-red-400 hover:text-red-700 hover:underline disabled:opacity-50 transition"
        >
          {isPending ? '…' : 'Mark as spam'}
        </button>
      )}
    </div>
  );
}
