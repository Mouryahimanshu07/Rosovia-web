# Environment Variables — Rosovia

This document lists all environment variables required to run Rosovia locally and in production.
**Never commit real values to git.** Use `.env.local` for local development and the hosting platform's secrets store for production.

---

## Supabase

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Browser + Server | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Browser + Server | Supabase anonymous (public) key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server only** | Service role key — bypasses RLS. **Never expose to client.** Used only in webhook handlers and admin server actions. |
| `DATABASE_URL` | ✅ | **Server only** | Direct PostgreSQL connection string for migrations. Format: `postgres://postgres.[ref]:[password]@[host]:6543/postgres` |

---

## Cloudflare R2 (Media Storage)

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | ✅ | **Server only** | Your Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | ✅ | **Server only** | R2 access key — used to generate presigned URLs |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | ✅ | **Server only** | R2 secret key. **Never expose to browser.** |
| `CLOUDFLARE_R2_BUCKET_NAME` | ✅ | **Server only** | Name of your R2 bucket |
| `CLOUDFLARE_R2_PUBLIC_URL` | ✅ | **Server only** | Public base URL for public media (e.g. `https://pub-xxx.r2.dev` or your custom domain). Used to build `public_url` for media_assets. |

> ⚠️ R2 credentials are used only in server-side route handlers (`/api/media/signed-upload`, `/api/media/complete`, `/api/admin/media/[id]/signed-read-url`). They are never returned to the browser.

---

## Razorpay (Payments) & Feature Flags

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `PAYMENTS_ENABLED` | ✅ | **Server + Core** | Central boolean flag (default: `false`). Disables Razorpay order initialization actions and webhooks if set to `false`. |
| `LIVE_PAYMENTS_ENABLED` | ✅ | **Server + Core** | Central boolean flag (default: `false`). Selects between Razorpay live production mode and local sandbox testing. |
| `RAZORPAY_KEY_ID` | ✅ | **Server only** (returned from action) | Razorpay publishable key (e.g. `rzp_test_...` or `rzp_live_...`). Returned from server action and passed to the Razorpay Checkout SDK. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ✅ | Browser + Server | The publishable key exposed directly to Next.js browser layout scripts. |
| `RAZORPAY_KEY_SECRET` | ✅ | **Server only** | Razorpay secret key — used to call the Razorpay Orders API. **Never expose to client.** |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | **Server only** | Used to verify HMAC-SHA256 webhook signature. **Never expose to client.** |

---

## Sentry (Error Tracking)

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Browser + Server | The Sentry DSN (public). Safe to expose. App silently skips Sentry if absent. |
| `SENTRY_DSN` | Recommended | **Server only** | Server-side Sentry DSN fallback. |
| `SENTRY_AUTH_TOKEN` | CI/CD only | **CI/CD secrets only** | Used to upload source maps during build. **Never put in `.env.local` or commit to git.** |
| `SENTRY_ORG` | CI/CD only | Build-time | Your Sentry organisation slug |
| `SENTRY_PROJECT` | CI/CD only | Build-time | Your Sentry project slug |

---

## PostHog (Product Analytics)

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Recommended | Browser | PostHog project API key. Analytics are disabled if absent. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Recommended | Browser | PostHog API host. Default: `https://app.posthog.com` |

---

## Local `.env.local` Template

Create `apps/web/.env.local` with the following structure (fill in real values, never commit):

```env
# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
DATABASE_URL=postgres://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:6543/postgres

# ─── Cloudflare R2 ────────────────────────────────────────────────────────────
CLOUDFLARE_R2_ACCOUNT_ID=YOUR_CF_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_KEY
CLOUDFLARE_R2_BUCKET_NAME=YOUR_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL=https://pub-XXXX.r2.dev

# ─── Razorpay ─────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_XXXX
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXX
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# ─── Feature Flags ────────────────────────────────────────────────────────────
PAYMENTS_ENABLED=false
LIVE_PAYMENTS_ENABLED=false

# ─── Sentry (optional for local) ──────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://XXXX@oXXXX.ingest.sentry.io/XXXX
SENTRY_DSN=https://XXXX@oXXXX.ingest.sentry.io/XXXX

# ─── PostHog (optional for local) ─────────────────────────────────────────────
NEXT_PUBLIC_POSTHOG_KEY=phc_XXXX
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It must **only** be used in:
  - The Razorpay webhook handler (`/api/webhooks/razorpay`)
  - Admin-only server actions and API routes
  - Server-side admin Supabase clients
- No `NEXT_PUBLIC_` prefix for any secret. Variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JavaScript.
- `SENTRY_AUTH_TOKEN` must never appear in `.env.local` — it is a CI/CD-only secret for source map uploads.
- All R2 credentials are used only inside server route handlers; they never reach the browser.
- `RAZORPAY_KEY_ID` is returned from the `createPaymentForOrderAction` server action — this is intentional and safe (it is a publishable key, equivalent to a Stripe publishable key).
