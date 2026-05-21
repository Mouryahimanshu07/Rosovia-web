# Analytics and Monitoring — Rosovia Module 16

## Overview

Module 16 adds lightweight, privacy-safe product analytics (PostHog) and error tracking (Sentry) to the Rosovia platform. No new marketplace features are introduced.

---

## Required Environment Variables

```env
# PostHog analytics (client-visible — safe public key)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry error tracking
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...  # client-visible DSN (not a secret)
SENTRY_DSN=...                                      # server-only fallback
SENTRY_AUTH_TOKEN=...                               # NEVER commit — CI/CD source map upload only
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=rosovia
```

> **Note:** `SENTRY_AUTH_TOKEN` must never be committed. Add it to CI/CD secrets only.

---

## PostHog Setup

### Initialization
- `apps/web/src/lib/analytics/posthog.ts` — singleton client, `initPostHog()`, `trackEvent()`, `identifyUser()`, `resetAnalytics()`
- `apps/web/src/components/providers/posthog-provider.tsx` — Client Component that initializes on mount and tracks pageviews on route change
- `apps/web/src/app/layout.tsx` — wraps the app with `<PostHogProvider>`

### Behavior
- PostHog is **disabled in development** via `opt_out_capturing()` — events are not sent
- PostHog is a **no-op** if `NEXT_PUBLIC_POSTHOG_KEY` is missing — app never crashes
- Session recording is **disabled** — `disable_session_recording: true`
- Pageviews track **pathname only** — search params are intentionally excluded to avoid PII leakage

---

## Sentry Setup

### Files
- `apps/web/instrumentation-client.ts` — client-side Sentry init (recommended Next.js convention)
- `apps/web/sentry.client.config.ts` — kept for backward compatibility with current Next.js 14
- `apps/web/sentry.server.config.ts` — server-side init
- `apps/web/sentry.edge.config.ts` — edge runtime init
- `apps/web/instrumentation.ts` — Next.js hook that registers server/edge configs on startup
- `apps/web/next.config.mjs` — wrapped with `withSentryConfig()`

### Error Capture Helper
`apps/web/src/lib/analytics/capture-error.ts` — `captureAppError(error, context)`:
- Always logs to `console.error` server-side
- Sends to Sentry in production
- Context must never include secrets, webhook payloads, or PII

### `beforeSend` Scrub
Sentry client config strips these keys from event request data before sending:
`password`, `token`, `secret`, `key`, `webhook`, `payload`, `raw_body`

### Behavior
- Sentry is **disabled** if DSN is missing — app runs normally
- Sentry is **disabled in development** — `enabled: process.env.NODE_ENV === 'production'`
- Source maps upload only when `SENTRY_AUTH_TOKEN` is set (CI/CD only)

---

## Error Boundaries

| File | Purpose |
|---|---|
| `apps/web/src/app/global-error.tsx` | Root-level catch-all. Renders `<html>/<body>` itself. |
| `apps/web/src/app/error.tsx` | Route-segment error boundary. |
| `apps/web/src/components/error/error-state.tsx` | Reusable error UI component. |

---

## Error Classes

`packages/core/src/errors/app-error.ts`:

| Class | HTTP Code | Code |
|---|---|---|
| `AppError` | 500 | `INTERNAL_ERROR` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthError` | 401 | `AUTH_ERROR` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `ExternalServiceError` | 502 | `EXTERNAL_SERVICE_ERROR` |

---

## Analytics Event Catalog

All events are defined in `packages/core/src/analytics/events.ts` as `ANALYTICS_EVENTS` constants.

| Event | Key Properties | Privacy Notes |
|---|---|---|
| `signup_completed` | `role` | ✅ Safe |
| `login_completed` | `role` | ✅ Safe |
| `creator_profile_created` | `primary_category_slug` | ✅ Safe |
| `creator_profile_updated` | `has_profile_image`, `primary_category_slug` | ✅ Safe |
| `category_viewed` | `category_slug`, `category_type` | ✅ Safe |
| `listing_viewed` | `listing_type`, `category_slug`, `creator_verified` | ✅ Safe |
| `listing_created` | `listing_type`, `category_slug`, `custom_order_available` | ✅ Safe |
| `listing_submitted_for_review` | `listing_type`, `category_slug` | ✅ Safe |
| `inquiry_sent` | `inquiry_type`, `has_listing` | ✅ Safe |
| `custom_order_requested` | `has_listing`, `category_slug`, `budget_provided` | ✅ Safe |
| `custom_order_quoted` | `status` | ✅ Safe |
| `order_created` | `source`, `payment_status`, `order_status` | ✅ Safe |
| `payment_started` | `provider`, `order_status`, `payment_status` | ✅ Safe |
| `payment_completed` | `provider`, `source` | ✅ Safe — no amounts |
| `review_submitted` | `rating`, `has_comment` | ✅ Safe |
| `verification_requested` | `verification_type`, `requested_level`, `document_type` | ✅ Safe |
| `report_submitted` | `target_type`, `reason` | ✅ Safe |
| `admin_action_performed` | `action_type`, `target_type` | ✅ Safe |

### Events Instrumented in Module 16
- `captureAppError` added to: Razorpay webhook, payment creation, report submission
- Client `trackEvent` calls: documented as future instrumentation in page components (see below)

### Future Instrumentation (not yet added)
These events are defined but client-side `trackEvent()` calls were not added to avoid over-refactoring existing modules:
- `signup_completed`, `login_completed` — add in auth form `onSuccess` callbacks
- `listing_viewed`, `category_viewed` — add in `useEffect` on respective public pages
- `payment_started`, `review_submitted` — add in client components after successful server action

---

## Privacy Rules

- ❌ Never track raw email, phone, address
- ❌ Never track document URLs or private media URLs
- ❌ Never track Razorpay secrets or webhook payloads
- ❌ Never expose `SENTRY_AUTH_TOKEN` to client
- ❌ Never expose `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Only use profile IDs (not email) for PostHog identity
- ✅ Use high-level metadata: role, category slug, listing type, status flags
- ✅ All `trackEvent` calls guarded: no-op if env var missing

---

## Health Endpoint

`GET /api/health`

Response:
```json
{
  "status": "ok",
  "app": "rosovia",
  "timestamp": "2026-05-16T00:00:00.000Z"
}
```

No secrets exposed. No database tested. Use for uptime monitor pings.

---

## Local Testing

```bash
# 1. Add env vars to apps/web/.env.local
NEXT_PUBLIC_POSTHOG_KEY=your_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_SENTRY_DSN=your_dsn

# 2. Start dev server
pnpm dev

# 3. Test health endpoint
curl http://localhost:3000/api/health

# 4. Note: PostHog is opt_out in development — events will not be sent
#    To test event capture, temporarily remove opt_out from posthog.ts

# 5. Note: Sentry is disabled in development
#    To test Sentry, set NODE_ENV=production or temporarily remove the enabled guard
```

---

## What Was Intentionally Not Implemented

- Server-side PostHog SDK (client-side tracking is sufficient for MVP)
- PostHog session recording (disabled for privacy)
- Automated Slack/email alerts
- Data warehouse / custom BI
- A/B testing
- Automated KYC / AI moderation
- Payment analytics dashboard
- Mobile analytics
- Redis / queue-based event processing
