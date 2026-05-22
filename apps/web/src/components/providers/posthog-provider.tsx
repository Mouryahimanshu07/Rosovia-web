'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadAnalyticsDeferred } from '~/lib/analytics/lazy-analytics';

interface PostHogProviderProps {
  children: React.ReactNode;
}

/**
 * PostHogProvider — initializes PostHog and tracks pageviews asynchronously.
 * Wrap the root layout body content with this client component.
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    // Shunt initial setup to client idle queue
    loadAnalyticsDeferred();

    // Register Service Worker for PWA shell caching and offline features
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('[PWA] ServiceWorker registered successfully with scope: ', registration.scope);
            }
          })
          .catch((err) => {
            console.error('[PWA] ServiceWorker registration failed: ', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

  useEffect(() => {
    // Capture page changes cleanly without static imports
    const trackPageview = async () => {
      if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
      try {
        const { default: posthog } = await import('posthog-js');
        if (posthog.__loaded) {
          posthog.capture('$pageview', {
            $current_url: window.location.origin + pathname,
          });
        }
      } catch {
        // Analytics must never block user operations
      }
    };
    trackPageview();
  }, [pathname]);

  return <>{children}</>;
}
