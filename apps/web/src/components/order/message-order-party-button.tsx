'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { startConversationAction } from '~/app/dashboard/messages/actions';

interface MessageOrderPartyButtonProps {
  /** The creator profile ID (required to start/find the conversation). */
  creatorId: string;
  /** Optional order ID to associate with the conversation. */
  orderId?: string;
  /** Who this current user is — controls label text. */
  viewAs: 'buyer' | 'creator';
}

export function MessageOrderPartyButton({
  creatorId,
  orderId,
  viewAs,
}: MessageOrderPartyButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const label = viewAs === 'buyer' ? '💬 Message Creator' : '💬 Message Buyer';

  const handleClick = () => {
    startTransition(async () => {
      const result = await startConversationAction(creatorId, orderId ?? null, null);
      if (result.success && result.data) {
        const roleParam = viewAs === 'creator' ? '&role=creator' : '';
        router.push(`/dashboard/messages?id=${result.data}${roleParam}`);
      } else {
        // Fallback: navigate to inbox anyway
        router.push('/dashboard/messages');
      }
    });
  };

  return (
    <button
      id={`message-party-${orderId ?? creatorId}`}
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 transition"
    >
      {isPending ? (
        <>
          <span className="h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
          Opening…
        </>
      ) : (
        label
      )}
    </button>
  );
}
