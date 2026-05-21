'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface ErrorStateProps {
  heading?: string;
  message?: string;
  showReset?: boolean;
  onReset?: () => void;
  showHome?: boolean;
}

export function ErrorState({
  heading = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again or return to the home page.',
  showReset = true,
  onReset,
  showHome = true,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">{heading}</h1>
      <p className="mb-6 max-w-md text-sm text-gray-500">{message}</p>
      <div className="flex items-center gap-3">
        {showReset && onReset && (
          <button
            onClick={onReset}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Try again
          </button>
        )}
        {showHome && (
          <a
            href="/"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go home
          </a>
        )}
      </div>
    </div>
  );
}
