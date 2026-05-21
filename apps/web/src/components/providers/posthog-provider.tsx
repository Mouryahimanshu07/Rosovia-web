'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import { initPostHog } from '~/lib/analytics/posthog';

interface PostHogProviderProps {
  children: React.ReactNode;
}

/**
 * PostHogProvider — initializes PostHog and tracks pageviews.
 * Must be a Client Component. Wrap the root layout body content with this.
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    // Track pathname-only pageviews — no search params to avoid PII leakage
    try {
      posthog.capture('$pageview', { $current_url: window.location.origin + pathname });
    } catch {
      // Silent — analytics should never crash the app
    }
  }, [pathname]);

  return <>{children}</>;
}
