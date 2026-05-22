'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderStatusAction } from '~/app/actions/orders';
import { ShipDeliverModal } from './ship-deliver-modal';
import { DisputeFormModal } from './dispute-form-modal';
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
  const [isPending, startTransition] = React.useTransition();
  const [activeModal, setActiveModal] = React.useState<'ship' | 'deliver' | 'dispute' | null>(null);

  // ── Creator eligibility ──
  const canMarkAccepted =
    viewAs === 'creator' && ['payment_pending', 'requested'].includes(orderStatus);

  const canMarkInProgress =
    viewAs === 'creator' && orderStatus === 'accepted';

  // Ship and Deliver now open modals instead of instant status transitions
  const canMarkShipped =
    viewAs === 'creator' && orderStatus === 'in_progress';

  const canMarkDelivered =
    viewAs === 'creator' && orderStatus === 'shipped';

  // ── Buyer eligibility ──
  // Mark Completed is now handled by FulfillmentDetailsCard's "Confirm Delivery" button
  // so we only show it here if there is NO delivery record (simple/manual orders).
  const canMarkCompleted =
    viewAs === 'buyer' && orderStatus === 'delivered';

  const canCancel =
    viewAs === 'buyer' &&
    ['payment_pending', 'accepted', 'requested'].includes(orderStatus) &&
    ['created', 'pending'].includes(paymentStatus);

  // Both buyer and creator can open disputes on active orders
  const canDispute =
    !['cancelled', 'completed', 'refunded', 'draft'].includes(orderStatus) &&
    ['accepted', 'in_progress', 'shipped', 'delivered', 'payment_pending'].includes(orderStatus);

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
    <>
      {/* Modals */}
      {activeModal === 'ship' && (
        <ShipDeliverModal
          orderId={orderId}
          mode="ship"
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'deliver' && (
        <ShipDeliverModal
          orderId={orderId}
          mode="deliver"
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'dispute' && (
        <DisputeFormModal
          orderId={orderId}
          onClose={() => setActiveModal(null)}
        />
      )}

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
            onClick={() => setActiveModal('ship')}
            className="text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
          >
            🚚 Mark Shipped
          </button>
        )}
        {canMarkDelivered && (
          <button
            id={`order-deliver-${orderId}`}
            disabled={isPending}
            onClick={() => setActiveModal('deliver')}
            className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
          >
            🎁 Mark Delivered
          </button>
        )}
        {canMarkCompleted && (
          <button
            id={`order-complete-${orderId}`}
            disabled={isPending}
            onClick={() => handle('mark_completed')}
            className="text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-md px-3 py-1.5 transition disabled:opacity-50"
          >
            {isPending ? '…' : '✅ Mark Completed'}
          </button>
        )}
        {canDispute && (
          <button
            id={`order-dispute-${orderId}`}
            disabled={isPending}
            onClick={() => setActiveModal('dispute')}
            className="text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md px-3 py-1.5 transition disabled:opacity-50"
          >
            ⚖️ Raise Dispute
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
    </>
  );
}
