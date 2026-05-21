# Production Readiness Checklist — Rosovia

Use this before any production deployment.

---

## ✅ Environment Variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — set to production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — set to production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — set (server-only, never exposed to client)
- [ ] `DATABASE_URL` — set to production DB connection string
- [ ] `CLOUDFLARE_R2_ACCOUNT_ID` — set
- [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID` — set
- [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — set (never expose to client)
- [ ] `CLOUDFLARE_R2_BUCKET_NAME` — set
- [ ] `CLOUDFLARE_R2_PUBLIC_URL` — set
- [ ] `RAZORPAY_KEY_ID` — set (`NEXT_PUBLIC_` version for checkout if needed)
- [ ] `RAZORPAY_KEY_SECRET` — set (server-only)
- [ ] `RAZORPAY_WEBHOOK_SECRET` — set (server-only)
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` — set
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` — set (default: `https://app.posthog.com`)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — set (public DSN is safe to expose)
- [ ] `SENTRY_DSN` — set (server fallback)
- [ ] `SENTRY_AUTH_TOKEN` — set in CI/CD secrets only
- [ ] `SENTRY_ORG` — set
- [ ] `SENTRY_PROJECT` — set

---

## ✅ Supabase Database

- [ ] All migrations applied: `supabase db push`
  - 001_core_schema
  - 002_creator_profile
  - 003_listings
  - 004_media_assets
  - 005_explore_search_indexes
  - 006_inquiries
  - 007_custom_orders
  - 008_orders
  - 009_payments
  - 010_reviews
  - 011_verification
  - 012_reports_moderation
  - 013_admin_dashboard_support
  - 014_admin_actions_category_target
- [ ] RLS enabled on all tables
- [ ] Seed categories applied (if needed)
- [ ] Admin user account created (role = admin, status = active)
- [ ] Database types regenerated: `supabase gen types typescript`

---

## ✅ Security

- [ ] No hardcoded secrets in any source file
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used in server actions / admin client
- [ ] `RAZORPAY_KEY_SECRET` never exposed to client
- [ ] `RAZORPAY_WEBHOOK_SECRET` only used in webhook signature verification
- [ ] `SENTRY_AUTH_TOKEN` never in `.env.local` or committed to git
- [ ] RLS policies cover all public tables
- [ ] Admin routes server-side protected (`role = admin`, `status = active`)
- [ ] Verification document URLs not exposed publicly
- [ ] Razorpay webhook `raw_payload` not sent to Sentry

---

## ✅ Cloudflare R2 (Media Upload)

- [ ] R2 bucket created and configured
- [ ] CORS policy set on R2 bucket for production domain
- [ ] Public URL configured for public media assets
- [ ] Private media paths not publicly accessible
- [ ] Presigned URL TTL is appropriate (default: 15 minutes)

---

## ✅ Razorpay

- [ ] Razorpay account live/test mode confirmed
- [ ] Webhook URL registered: `https://yourdomain.com/api/webhooks/razorpay`
- [ ] Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Signature verification confirmed working
- [ ] Test payment end-to-end flow verified

---

## ✅ Sentry

- [ ] Project created in Sentry dashboard
- [ ] DSN configured
- [ ] `global-error.tsx` error boundary active
- [ ] `captureAppError` used in: webhook, payments, reports
- [ ] Source maps uploaded via `SENTRY_AUTH_TOKEN` (CI/CD)
- [ ] Test error captured in Sentry dashboard

---

## ✅ PostHog

- [ ] PostHog project created
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` set
- [ ] Pageview events flowing in PostHog live view
- [ ] Session recording disabled (confirm in PostHog project settings)
- [ ] Privacy policy updated to mention analytics collection

---

## ✅ Build

- [ ] `pnpm lint` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — succeeds
- [ ] `/api/health` returns `{ status: 'ok' }`

---

## ✅ Manual QA Checklist

- [ ] Signup as buyer → dashboard redirect correct
- [ ] Signup as creator → onboarding flow works
- [ ] Creator profile create/edit works
- [ ] Listing create / submit for review works
- [ ] Media upload (profile image, listing image) works
- [ ] Explore / search returns results
- [ ] `/listings/[slug]` public page renders
- [ ] `/creators/[slug]` public page renders
- [ ] Inquiry form submits and appears in creator dashboard
- [ ] Custom order request → quote flow works
- [ ] Order creation from listing works
- [ ] Razorpay checkout opens (test mode)
- [ ] Webhook processes payment (simulate via Razorpay dashboard)
- [ ] Review submission and rating update works
- [ ] Verification request submits
- [ ] Report submits
- [ ] Admin dashboard loads (requires admin account)
- [ ] Admin: suspend user → user locked out
- [ ] Admin: approve listing → listing appears publicly
- [ ] Audit log records all admin actions

---

## ✅ Deployment

- [ ] Production build passes (`pnpm build`)
- [ ] Environment variables set in hosting platform (Vercel / Railway / etc.)
- [ ] Domain configured
- [ ] HTTPS enforced
- [ ] Supabase auth `Site URL` set to production domain
- [ ] Supabase auth `Redirect URLs` include production callback URL
- [ ] Razorpay webhook URL updated to production domain

---

## ✅ Rollback Plan

- [ ] Previous deployment snapshot saved (Vercel instant rollback)
- [ ] Database migration is non-destructive (verified before push)
- [ ] Rollback procedure documented: revert via hosting platform + `supabase db push` with previous migration state
