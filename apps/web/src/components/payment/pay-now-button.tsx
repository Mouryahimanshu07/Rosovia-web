'use client';

import { useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPaymentForOrderAction } from '~/app/actions/payments';

interface PayNowButtonProps {
  orderId: string;
  amountDisplay: string;
}

// Extend the Window interface for Razorpay Checkout
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  modal: {
    ondismiss: () => void;
    confirm_close?: boolean;
  };
  theme: { color: string };
  prefill?: { name?: string; email?: string; contact?: string };
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PayNowButton({ orderId, amountDisplay }: PayNowButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePay = useCallback(() => {
    startTransition(async () => {
      // 1. Create Razorpay order and get checkout data from server
      const result = await createPaymentForOrderAction({ orderId });

      if (!result.success) {
        alert(result.error ?? 'Failed to initiate payment. Please try again.');
        return;
      }

      const checkoutData = result.data;
      if (!checkoutData) {
        alert('No checkout data returned. Please try again.');
        return;
      }

      // 2. Load Razorpay Checkout script
      const loaded = await loadRazorpayScript();
      if (!loaded || typeof window.Razorpay === 'undefined') {
        alert('Could not load payment gateway. Please check your connection and try again.');
        return;
      }

      // 3. Open Razorpay Checkout modal
      const rzp = new window.Razorpay({
        key: checkoutData.razorpayKeyId,
        amount: checkoutData.amountInPaise,
        currency: checkoutData.currency,
        order_id: checkoutData.providerOrderId,
        name: 'Rosovia',
        description: 'Order Payment',
        handler: (_response: RazorpayResponse) => {
          // Client handler fires after payment UI completes.
          // DO NOT mark as paid here — webhook is the source of truth.
          // Show a confirmation message and refresh the page.
          router.refresh();
          // Redirect to order page to show "Payment processing" state
          router.push(`/dashboard/buyer/orders/${orderId}?payment=processing`);
        },
        modal: {
          ondismiss: () => {
            // User closed the modal without completing payment
            router.refresh();
          },
          confirm_close: true,
        },
        theme: {
          color: '#1a1a2e',
        },
      });

      rzp.open();
    });
  }, [orderId, router]);

  return (
    <button
      id={`pay-now-${orderId}`}
      disabled={isPending}
      onClick={handlePay}
      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <>
          <span
            className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"
            aria-hidden="true"
          />
          Preparing payment…
        </>
      ) : (
        <>
          <span aria-hidden="true">💳</span>
          Pay Now · {amountDisplay}
        </>
      )}
    </button>
  );
}
