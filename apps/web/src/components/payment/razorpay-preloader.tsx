'use client';

import Script from 'next/script';

/**
 * RazorpayPreloader — loads the Razorpay script asynchronously in the background.
 * Mount this component on high-intent buyer pages (e.g., listing page, booking page, checkout form)
 * to prime the cache and eliminate the multi-second loading latency when clicking "Pay Now".
 */
export function RazorpayPreloader() {
  return (
    <Script
      src="https://checkout.razorpay.com/v1/checkout.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RazorpayPreloader] Checkout script successfully loaded in background.');
        }
      }}
      onError={(e) => {
        console.error('[RazorpayPreloader] Failed to preload Razorpay checkout script:', e);
      }}
    />
  );
}
