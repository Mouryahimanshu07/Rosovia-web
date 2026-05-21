'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorState } from '~/components/error/error-state';

/**
 * Next.js global error boundary — catches errors from the root layout.
 * Must be a Client Component and must render <html> + <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <ErrorState
          heading="Application Error"
          message="A critical error occurred. Our team has been notified. Please refresh or return to the home page."
          onReset={reset}
          showReset
          showHome
        />
      </body>
    </html>
  );
}
