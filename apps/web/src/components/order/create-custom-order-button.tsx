'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrderFromCustomOrderAction } from '~/app/actions/orders';

interface CreateCustomOrderButtonProps {
  customOrderId: string;
}

export function CreateCustomOrderButton({ customOrderId }: CreateCustomOrderButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createOrderFromCustomOrderAction({ customOrderId });
      if (!result.success) {
        alert(result.error ?? 'Failed to create order');
      } else if (result.data) {
        router.push(`/dashboard/buyer/orders/${result.data.orderId}`);
      }
    });
  };

  return (
    <button
      id={`create-order-custom-${customOrderId}`}
      disabled={isPending}
      onClick={handleClick}
      className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
    >
      {isPending ? (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
          Creating…
        </span>
      ) : (
        'Create Order'
      )}
    </button>
  );
}
