/**
 * PostHog deferred loading utility (browser-only).
 * Resolves main thread blockages by lazy-loading analytics script.
 */
export async function loadAnalyticsDeferred(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const init = async () => {
    try {
      // Shave ~45KB (gzip) from the initial bundle via dynamic imports
      const { default: posthog } = await import('posthog-js');
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

      if (!posthog.__loaded) {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: host,
          capture_pageview: false, // Pageviews captured manually in posthog-provider
          capture_pageleave: true,
          persistence: 'localStorage',
          disable_session_recording: true,
          loaded: (ph) => {
            if (process.env.NODE_ENV === 'development') {
              ph.opt_out_capturing();
            }
          },
        });
        
        // Manual capture of the initial page view since we initialized post-hydration
        posthog.capture('$pageview', {
          $current_url: window.location.origin + window.location.pathname,
        });
      }
    } catch (e) {
      console.warn('[LazyAnalytics] PostHog deferred loading failed:', e);
    }
  };

  // Schedule loading during idle times so it doesn't block critical-path rendering
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      init();
    });
  } else {
    // Fallback for older browsers
    setTimeout(init, 1000);
  }
}
