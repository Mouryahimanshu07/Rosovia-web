/**
 * PostHog analytics client for Rosovia (browser-only).
 *
 * Rules:
 * - Never import this file in Server Components or server actions.
 * - All event properties must be privacy-safe (no PII, no secrets).
 * - If NEXT_PUBLIC_POSTHOG_KEY is missing, all calls are silent no-ops.
 */

import posthog from 'posthog-js';
import type { AnalyticsEventName, AnalyticsEventProperties } from '@rosovia/core';

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

  if (!key) {
    // Analytics disabled — no env var. Safe to proceed without tracking.
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: false, // We handle pageviews manually via PostHogProvider
    capture_pageleave: true,
    persistence: 'localStorage',
    // Privacy: disable session recording by default
    disable_session_recording: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        // Log events in dev without sending to PostHog
        ph.opt_out_capturing();
      }
    },
  });

  initialized = true;
}

/**
 * Track a product analytics event.
 * Type-safe: event name must be from ANALYTICS_EVENTS, properties must match.
 */
export function trackEvent<K extends AnalyticsEventName>(
  eventName: K,
  properties: K extends keyof AnalyticsEventProperties
    ? AnalyticsEventProperties[K]
    : Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    posthog.capture(eventName, properties as Record<string, unknown>);
  } catch {
    // Never crash the app because of analytics
  }
}

/**
 * Identify the authenticated user. Uses profile ID only — never email/phone.
 */
export function identifyUser(profileId: string, properties?: { role?: string }): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    posthog.identify(profileId, properties);
  } catch {
    // Silent
  }
}

/**
 * Reset PostHog identity on logout.
 */
export function resetAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    posthog.reset();
  } catch {
    // Silent
  }
}
