import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@rosovia/ui', '@rosovia/core', '@rosovia/integrations', '@rosovia/api'],
  // Required by Next.js instrumentation hook
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set via env vars in CI/CD)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppresses Sentry build-time warnings when env vars are absent
  silent: true,

  // Do not auto-instrument server functions — we use captureAppError manually
  webpack: {
    autoInstrumentServerFunctions: false,
  },

  // Upload source maps only in production CI — requires SENTRY_AUTH_TOKEN
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
