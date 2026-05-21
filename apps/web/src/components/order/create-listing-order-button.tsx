'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrderFromListingAction } from '~/app/actions/orders';

interface CreateListingOrderButtonProps {
  listingId: string;
}

export function CreateListingOrderButton({ listingId }: CreateListingOrderButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createOrderFromListingAction({ listingId });
      if (!result.success) {
        alert(result.error ?? 'Failed to create order');
      } else if (result.data) {
        router.push(`/dashboard/buyer/orders/${result.data.orderId}`);
      }
    });
  };

  return (
    <button
      id={`create-order-listing-${listingId}`}
      disabled={isPending}
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
          Creating…
        </>
      ) : (
        'Request Purchase'
      )}
    </button>
  );
}
