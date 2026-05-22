'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { acceptAndCreateCustomOfferOrderAction } from './actions';

interface AcceptOfferButtonProps {
  customOrderId: string;
}

export function AcceptOfferButton({ customOrderId }: AcceptOfferButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptAndCreateCustomOfferOrderAction(customOrderId);
      if (!result.success) {
        setError(result.error);
      } else if (result.data) {
        // Redirect directly to the newly created order checkout details page
        router.push(`/dashboard/buyer/orders/${result.data}`);
      }
    });
  };

  return (
    <div className="mt-4 flex flex-col space-y-2">
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 text-center"
      >
        {isPending ? 'Processing Proposal...' : '⚡ Accept & Pay Now'}
      </button>
      {error && (
        <p className="text-[11px] font-medium text-red-400 text-center">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
