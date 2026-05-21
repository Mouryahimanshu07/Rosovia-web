'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderStatusAction } from '~/app/actions/orders';
import type { OrderStatus, PaymentStatus, OrderStatusUpdateInput } from '@rosovia/core';

interface OrderActionsProps {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  viewAs: 'buyer' | 'creator';
}

export function OrderActions({
  orderId,
  orderStatus,
  paymentStatus,
  viewAs,
}: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canCancel =
    viewAs === 'buyer' &&
    ['payment_pending', 'accepted', 'requested'].includes(orderStatus) &&
    ['created', 'pending'].includes(paymentStatus);

  const canMarkAccepted =
    viewAs === 'creator' && ['payment_pending', 'requested'].includes(orderStatus);

  const canMarkInProgress =
    viewAs === 'creator' && orderStatus === 'accepted';

  const canMarkShipped =
    viewAs === 'creator' && orderStatus === 'in_progress';

  const canMarkDelivered =
    viewAs === 'creator' && orderStatus === 'shipped';

  const canMarkCompleted =
    viewAs === 'buyer' && orderStatus === 'delivered';

  const canDispute =
    ['payment_pending', 'accepted', 'in_progress', 'shipped', 'delivered'].includes(orderStatus);

  const hasAnyAction =
    canCancel ||
    canMarkAccepted ||
    canMarkInProgress ||
    canMarkShipped ||
    canMarkDelivered ||
    canMarkCompleted ||
    canDispute;

  if (!hasAnyAction) return null;

  const handle = (action: OrderStatusUpdateInput['action']) => {
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, action });
      if (!result.success) {
        alert(result.error ?? 'Action failed');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Order actions">
      {canMarkAccepted && (
        <button
          id={`order-accept-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_accepted')}
          className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Accept Order'}
        </button>
      )}
      {canMarkInProgress && (
        <button
          id={`order-inprogress-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_in_progress')}
          className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Start Work'}
        </button>
      )}
      {canMarkShipped && (
        <button
          id={`order-ship-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_shipped')}
          className="text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Mark Shipped'}
        </button>
      )}
      {canMarkDelivered && (
        <button
          id={`order-deliver-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_delivered')}
          className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Mark Delivered'}
        </button>
      )}
      {canMarkCompleted && (
        <button
          id={`order-complete-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_completed')}
          className="text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Mark Completed'}
        </button>
      )}
      {canDispute && (
        <button
          id={`order-dispute-${orderId}`}
          disabled={isPending}
          onClick={() => handle('mark_disputed')}
          className="text-xs font-medium text-orange-700 border border-orange-300 hover:bg-orange-50 rounded-md px-3 py-1.5 transition disabled:opacity-50"
        >
          {isPending ? '…' : 'Raise Dispute'}
        </button>
      )}
      {canCancel && (
        <button
          id={`order-cancel-${orderId}`}
          disabled={isPending}
          onClick={() => handle('cancel')}
          className="text-xs text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50 transition ml-auto"
        >
          {isPending ? '…' : 'Cancel Order'}
        </button>
      )}
    </div>
  );
}
