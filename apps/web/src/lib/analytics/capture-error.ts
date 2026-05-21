/**
 * captureAppError — server-safe Sentry error capture helper.
 *
 * Use in server actions, API routes, and service functions.
 * Always logs to console. Also sends to Sentry when configured.
 *
 * Rules:
 * - Do NOT pass raw payment payloads, webhook bodies, or document URLs.
 * - Do NOT include Razorpay/Supabase secrets in context.
 * - Strip any PII from context before passing.
 */

import * as Sentry from '@sentry/nextjs';

interface ErrorContext {
  module?: string;
  action?: string;
  userId?: string;  // profile ID only — never email
  [key: string]: unknown;
}

export function captureAppError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log server-side
  console.error(`[Rosovia Error]${context?.module ? ` [${context.module}]` : ''}`, err.message, context ?? '');

  // Send to Sentry if configured
  try {
    Sentry.captureException(err, {
      extra: context,
      tags: {
        module: context?.module ?? 'unknown',
        action: context?.action ?? 'unknown',
      },
    });
  } catch {
    // If Sentry itself fails, do not crash the app
  }
}
