# Production Readiness Checklist — Rosovia

Use this before any production deployment. Items marked **⛔ Blocker** must be resolved before going live.

---

## ⛔ Production Blockers (Must Resolve First)

These items are not yet implemented and are required before real users and real money:

- [ ] **Automated tests** — Unit and integration test coverage is minimal. Critical flows (payment webhook, order state machine, RLS enforcement) need automated test suites.
- [ ] **Load testing** — No load or stress tests have been run. Database query performance under concurrent load is unknown.
- [ ] **Real refund / payout provider integration** — The `refund_requests`, `disputes`, and `creator_payouts` tables exist, but actual money movement (Razorpay refund API, RazorpayX / bank transfer payout) is **not implemented**. All refunds and payouts are currently manual admin actions only.
- [ ] **Content moderation** — No automated image/text scanning. All content moderation is manual (admin reports queue).
- [ ] **Production monitoring alerts** — Sentry error tracking is configured, but no alert rules, on-call rotation, or uptime monitoring (e.g. Uptime Robot, Better Uptime) are set up.
- [ ] **Legal pages** — Privacy Policy, Terms of Service, Refund Policy, Cookie Notice are not written or published. Required before accepting payments from users.
- [ ] **Backup / restore drills** — No documented and tested database restore procedure. Supabase takes automatic backups, but recovery time has not been tested.
- [ ] **Rate limiting** — No request-level rate limiting on webhook routes or API endpoints. Must be added before public launch to prevent abuse.

---

## ✅ Environment Variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — set to production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — set to production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — set (server-only, **never** expose to client)
- [ ] `DATABASE_URL` — set to production DB connection string
- [ ] `CLOUDFLARE_R2_ACCOUNT_ID` — set
- [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID` — set (server-only)
- [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — set (server-only, **never** expose to client)
- [ ] `CLOUDFLARE_R2_BUCKET_NAME` — set
- [ ] `CLOUDFLARE_R2_PUBLIC_URL` — set (your R2 public domain or `pub-xxx.r2.dev`)
- [ ] `RAZORPAY_KEY_ID` — set
- [ ] `RAZORPAY_KEY_SECRET` — set (server-only)
- [ ] `RAZORPAY_WEBHOOK_SECRET` — set (server-only)
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` — set
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` — set (default: `https://app.posthog.com`)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — set (public DSN is safe to expose)
- [ ] `SENTRY_DSN` — set (server fallback)
- [ ] `SENTRY_AUTH_TOKEN` — set in CI/CD secrets only (**never** in `.env.local`)
- [ ] `SENTRY_ORG` — set in CI/CD
- [ ] `SENTRY_PROJECT` — set in CI/CD

See [docs/env.md](./env.md) for the full template.

---

## ✅ Supabase Database

- [ ] All 27 migrations applied: `supabase db push`
  - `001_foundation.sql`
  - `002_creator_profiles.sql`
  - `003_listings.sql`
  - `004_media_assets.sql`
  - `005_explore_search_indexes.sql`
  - `006_inquiries.sql`
  - `007_custom_orders.sql`
  - `008_orders.sql`
  - `009_payments.sql`
  - `010_reviews.sql`
  - `011_verification_requests.sql`
  - `012_reports_moderation.sql`
  - `013_admin_dashboard_support.sql`
  - `014_admin_actions_category_target.sql`
  - `015_security_hardening.sql`
  - `016_payment_order_transactions.sql`
  - `017_inventory_reservation.sql`
  - `018_financial_fields.sql`
  - `019_refunds_disputes_payouts.sql`
  - `020_media_moderation_hardening.sql`
  - `021_business_rule_rpcs.sql`
  - `022_media_protected_columns.sql`
  - `023_admin_atomic_actions.sql`
  - `024_search_optimization.sql`
  - `025_messaging.sql`
  - `026_notifications.sql`
  - `027_delivery_confirmation.sql`
- [ ] RLS enabled and tested on all tables
- [ ] Seed categories applied (`supabase db seed` or SQL Editor)
- [ ] Admin user created manually: `role = admin`, `status = active` in `profiles`
- [ ] Database types regenerated after final migration:
  ```bash
  supabase gen types typescript --schema public > packages/database/src/database.types.ts
  ```

---

## ✅ Security

- [ ] No hardcoded secrets in any source file (`git grep` for key patterns)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used in webhook handler and admin server clients
- [ ] `RAZORPAY_KEY_SECRET` never in client bundle (verify with browser devtools Network tab)
- [ ] `RAZORPAY_WEBHOOK_SECRET` only used in webhook signature verification
- [ ] `SENTRY_AUTH_TOKEN` never in `.env.local` or committed to git
- [ ] RLS policies cover all public tables (verify via Supabase Dashboard → Authentication → Policies)
- [ ] Admin dashboard routes server-side protected (`role = admin`, `status = active`)
- [ ] Verification document URLs never exposed publicly (no `public_url` for private R2 paths)
- [ ] Razorpay `raw_payload` not forwarded to Sentry (`beforeSend` scrub confirmed)

See [docs/security.md](./security.md) for full security architecture.

---

## ✅ Cloudflare R2 (Media Upload)

- [ ] R2 bucket created and configured
- [ ] CORS policy set on R2 bucket for production domain only (not `*`)
- [ ] Public URL (`CLOUDFLARE_R2_PUBLIC_URL`) configured and resolves correctly
- [ ] Private media paths (`private/`) not publicly accessible
- [ ] Presigned URL TTL appropriate (default: 15 minutes)
- [ ] Admin signed read URL route (`/api/admin/media/[id]/signed-read-url`) tested and access-controlled

---

## ✅ Razorpay

- [ ] Razorpay account in correct mode (test → live before real money)
- [ ] Webhook URL registered: `https://yourdomain.com/api/webhooks/razorpay`
- [ ] Webhook events enabled: `payment.captured`, `payment.failed`
- [ ] Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Signature verification confirmed working (test with invalid signature → must return 400)
- [ ] Test payment end-to-end flow verified

---

## ✅ Refunds, Disputes, and Payouts

> ⚠️ **Current state**: The database tables (`refund_requests`, `disputes`, `creator_payouts`) and the TypeScript service/repository layer are fully implemented. However, **actual money movement is not automated** — no Razorpay Refund API calls, no RazorpayX bank transfer calls are made. All refunds and payouts are currently manual admin operations.

- [ ] Confirm with team that manual-only payout/refund process is acceptable for launch scope
- [ ] Document the internal manual payout/refund SOP (Standard Operating Procedure)
- [ ] Set expectations with creators about payout timelines
- [ ] Future work: integrate Razorpay Refund API for automated refund processing
- [ ] Future work: integrate RazorpayX or bank transfer API for automated creator payouts

---

## ✅ Sentry (Error Tracking)

- [ ] Sentry project created
- [ ] DSN configured in production env
- [ ] `global-error.tsx` and `error.tsx` error boundaries active
- [ ] `captureAppError()` used in: webhook handler, payment action, report action
- [ ] Source maps uploaded via `SENTRY_AUTH_TOKEN` (CI/CD pipeline)
- [ ] Test error confirmed visible in Sentry dashboard

---

## ✅ PostHog (Analytics)

- [ ] PostHog project created
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` set
- [ ] Pageview events visible in PostHog live view after first visit
- [ ] Session recording disabled (confirm in PostHog project settings)
- [ ] Privacy policy updated to mention analytics

---

## ✅ Build Verification

- [ ] `pnpm lint` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm build` — succeeds
- [ ] `/api/health` returns `{ status: 'ok' }`

---

## ✅ Manual QA Checklist

- [ ] Signup as buyer → dashboard redirect correct
- [ ] Signup as creator → onboarding and profile creation works
- [ ] Creator profile create/edit/public view works
- [ ] Listing create / submit for review / admin approve / appear publicly
- [ ] Media upload (profile image, listing image, verification document)
- [ ] Explore / search returns results across pages
- [ ] `/listings/[slug]` public page renders
- [ ] `/creators/[slug]` public page renders
- [ ] Inquiry form submits and appears in creator dashboard
- [ ] Custom order request → quote → accept → create order flow
- [ ] Order creation from listing works
- [ ] Razorpay checkout opens and processes (test mode)
- [ ] Webhook processes payment.captured → order/payment status updated
- [ ] Review submission and creator rating recalculation works
- [ ] Verification request submits with private document
- [ ] Report submits on listing and creator profile
- [ ] Admin dashboard loads (requires admin account)
- [ ] Admin: suspend user → user locked out on next request
- [ ] Admin: approve listing → listing appears publicly
- [ ] Admin: approve verification → `is_verified` updated
- [ ] Audit log records all admin actions
- [ ] Buyer refunds page loads (`/dashboard/buyer/refunds`)
- [ ] Admin disputes page loads (`/dashboard/admin/disputes`)
- [ ] Creator payouts page loads (`/dashboard/creator/payouts`)
- [ ] Messaging dashboard sends and receives messages
- [ ] Notification inbox shows notifications

---

## ✅ Deployment

- [ ] Production build passes (`pnpm build`)
- [ ] All environment variables set in Vercel (Production + Preview environments)
- [ ] Domain configured and HTTPS enforced
- [ ] Supabase Auth `Site URL` set to production domain
- [ ] Supabase Auth `Redirect URLs` include production `/auth/callback`
- [ ] Razorpay webhook URL updated to production domain
- [ ] All 27 migrations applied to production database
- [ ] Database types regenerated and committed

See [docs/deployment/vercel-supabase-deployment.md](./deployment/vercel-supabase-deployment.md) for step-by-step instructions.

---

## ✅ Rollback Plan

- [ ] Previous deployment snapshot saved (Vercel instant rollback capability)
- [ ] Database migrations are non-destructive (verify before push)
- [ ] Rollback procedure documented: revert via Vercel dashboard + `supabase db push` to previous migration state
- [ ] Supabase point-in-time recovery window confirmed (Pro plan required for PITR)
