'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorState } from '~/components/error/error-state';

/**
 * Next.js route-level error boundary.
 * Catches errors thrown in page.tsx / layout.tsx for a specific route segment.
 */
export default function Error({
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
    <ErrorState
      heading="Page Error"
      message="Something went wrong on this page. Please try again or go back to the home page."
      onReset={reset}
      showReset
      showHome
    />
  );
}
