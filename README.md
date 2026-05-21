# Rosovia

Rosovia is a verified talent-commerce marketplace for artists, artisans, handmade creators, coders, designers, performers, teachers, mentors, small shops, and skilled people.

## MVP Architecture

Rosovia is built as a modular monolith inside a pnpm monorepo.
- `apps/web`: Next.js App Router application
- `packages/ui`: Shared UI components (Tailwind, Shadcn)
- `packages/core`: Core constants, types, and business rules
- `packages/integrations`: External service clients (Supabase, etc)
- `packages/database`: Supabase SQL migrations, seed data, and database types

## Development

### Install Dependencies
```bash
pnpm install
```

### Environment Setup
Copy `.env.example` to `.env.local` in `apps/web` and fill in the required values from your Supabase project.

### Run Development Server
```bash
pnpm dev
```

### Linting & Typechecking
```bash
pnpm lint
pnpm typecheck
```

### Build
```bash
pnpm build
```

## Database (Module 2)

Rosovia uses Supabase PostgreSQL with raw SQL migrations. No ORM is used.

### Apply Migration
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### Seed Categories (local)
```bash
supabase db reset
```

### Generate Database Types
```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF \
  > packages/database/src/database.types.ts
```

See [`packages/database/supabase/README.md`](./packages/database/supabase/README.md) for full database instructions.

## Current Status
- ✅ **Module 1: Foundation** — Monorepo, Next.js, shared packages, placeholder routes.
- ✅ **Module 2: Database Foundation** — `profiles` and `categories` tables, RLS policies, 9 category seeds.
- ✅ **Module 3: Authentication** — Signup, login, logout, password reset, session middleware, profile auto-creation, role-based dashboard routing.
- ✅ **Module 4: Creator Profile** — `creator_profiles` table, RLS, onboarding, edit, public profile pages (`/creators`, `/creators/[slug]`), slug generation, verification badge placeholder, rating summary placeholder.
- ✅ **Module 5: Listings** — `listings` table, RLS, 6 listing types, draft/pending/approved/archived status flow, creator listing dashboard, create/edit/archive/submit-for-review, public `/listings` and `/listings/[slug]`, listing cards, metadata jsonb, server actions.
- ✅ **Module 6: Media Upload** — `media_assets` table, 6 RLS policies, Cloudflare R2 integration, presigned PUT URL upload flow, file validation (type + size), profile image upload, listing image upload foundation, public/private media separation, `MediaUpload`/`ProfileImageUpload`/`ListingMediaUpload` components.
- ✅ **Module 7: Explore / Search** — PostgreSQL ILIKE search across listings, creators, categories. Query-param filters, Zod validation, pageSize=12 pagination. `/explore`, `/categories`, `/categories/[slug]`, `/listings`, `/creators` pages improved with full filter UI. Optional migration `005_explore_search_indexes.sql` with pg_trgm GIN indexes.
- ✅ **Module 8: Inquiry System** — `public.inquiries` table, 7 RLS policies, inquiry types/statuses, Zod validators, repository + service layers, server actions, `InquiryForm`/`InquiryReplyForm`/`InquiryStatusBadge`/`InquiryCard` components, buyer dashboard (`/dashboard/buyer/inquiries`), creator dashboard (`/dashboard/creator/inquiries`), live Send Inquiry forms on `/creators/[slug]` and `/listings/[slug]`.
- ✅ **Module 9: Custom Orders** — `public.custom_orders` table, 7 RLS policies, full status flow (requested → creator_reviewing → quoted → accepted/rejected/cancelled), Zod validators, repository + service layers, buyer/creator server actions, `CustomOrderForm`/`CustomOrderQuoteForm`/`CustomOrderStatusBadge`/`CustomOrderCard` components, buyer dashboard (`/dashboard/buyer/custom-orders`), creator dashboard (`/dashboard/creator/custom-orders`), live Request Custom Order forms on `/creators/[slug]` and `/listings/[slug]`.

- ✅ **Module 10: Orders** — `public.orders` + `public.order_status_history` tables, 13 RLS policies, full status flow (payment_pending → accepted → in_progress → shipped → delivered → completed/cancelled/disputed), Zod validators, repository + service layers, buyer/creator server actions, `OrderCard`/`OrderStatusBadge`/`PaymentStatusBadge`/`OrderActions`/`OrderStatusHistoryList` components, buyer orders dashboard (`/dashboard/buyer/orders`), creator orders dashboard (`/dashboard/creator/orders`), buyer/creator order detail pages, live "Request Purchase" on `/listings/[slug]`, "Create Order" on buyer custom-orders dashboard.

- ✅ **Module 11: Payments** — `public.payments` table, 5 RLS policies, Razorpay Checkout integration via REST API (no SDK), HMAC-SHA256 webhook signature verification, idempotency via `webhook_event_id`, `PayNowButton`/`PaymentStatusCard` components, server action `createPaymentForOrderAction`, webhook route `/api/webhooks/razorpay`, admin service-role Supabase client for trusted webhook writes, order `payment_status`/`order_status` updated to `paid` via verified webhook only. Creator fulfillment now allows `paid → in_progress`.

- ✅ **Module 12: Reviews** — `public.reviews` table, unique per-order constraint, 6 RLS policies, DB trigger `recalculate_creator_rating_trigger` auto-updates `creator_profiles.rating_avg/rating_count`, Zod validators, repository + service layers, buyer review creation with full eligibility enforcement (completed + paid order, no self-review, no duplicate), `ReviewForm`/`ReviewCard`/`RatingInput`/`RatingDisplay`/`ReviewList` components, buyer reviews dashboard (`/dashboard/buyer/reviews`), creator reviews dashboard (`/dashboard/creator/reviews`), review section on buyer order detail (`/dashboard/buyer/orders/[id]`), visible reviews on `/creators/[slug]` and `/listings/[slug]`, admin hide-review support at service/data level.

- ✅ **Module 13: Verification** — `public.verification_requests` table, one-pending-per-type partial unique index, 5 RLS policies, Zod validators, repository + service layers, full creator eligibility enforcement (active creator, no duplicate pending, media is private + owned + document/image type), admin approve/reject with `creator_profiles.is_verified` + `verification_level` update on approval, `VerificationLevelBadge`/`VerificationStatusCard`/`VerificationRequestForm`/`VerificationRequestCard`/`VerificationReviewActions` components, creator verification dashboard (`/dashboard/creator/verification`), admin verification review page (`/dashboard/admin/verification`), creator profile page updated with verification badge + request link, `trusted_seller` blocked from public requests, private document upload via existing MediaUpload, document metadata shown to admin (no download URLs — future work).

- ✅ **Module 14: Reports / Moderation** — `public.reports` + `public.admin_actions` tables, action constraint, Zod validators, service + repo layers with transaction-like side-effects (suspend/hide), buyer report form on listings/profiles, buyer dashboard (`/dashboard/buyer/reports`), admin moderation dashboards with side-effect resolution.
- ✅ **Module 15: Admin Dashboard** — 013 migration (extended constraints, 9 perf indexes), `admin_actions` integration, admin repository + service layer, 11 dedicated admin pages (Overview stats, Users, Creators, Categories CRUD, Listings moderation, Verification, Reports, Reviews moderation, Orders (RO), Payments (RO), Audit Logs (RO)), AdminLayout with sidebar.

- ✅ **Module 16: Analytics and Monitoring** — PostHog product analytics (browser-only, privacy-safe, dev-disabled), Sentry error tracking (client/server/edge configs, `beforeSend` scrub, disabled without DSN), `captureAppError()` helper (Razorpay webhook, payment action, report action), `AppError` class hierarchy, `ANALYTICS_EVENTS` typed event catalog, `PostHogProvider` with route-aware pageviews, `global-error.tsx` + `error.tsx` error boundaries, `ErrorState` component, `/api/health` endpoint, `docs/analytics-monitoring.md`, `docs/production-readiness.md`.

## Project Complete

All 16 modules are implemented. The platform is ready for production deployment.
See `docs/production-readiness.md` for the full deployment checklist.
