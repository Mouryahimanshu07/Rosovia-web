import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,

  // Capture a percentage of traces for performance monitoring
  tracesSampleRate: 0.1,

  // Do not send errors in development
  enabled: process.env.NODE_ENV === 'production',

  beforeSend(event) {
    // Scrub any accidentally included secrets from Sentry events
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'webhook', 'payload', 'raw_body'];
      for (const key of sensitiveKeys) {
        if (key in data) delete data[key];
      }
    }
    return event;
  },
});

// Required for Sentry navigation instrumentation in Next.js App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

