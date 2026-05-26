# Rosovia

Rosovia is a verified talent-commerce marketplace for artists, artisans, handmade creators, coders, designers, performers, teachers, mentors, small shops, and skilled people across India.

## Architecture

Rosovia is built as a modular monolith inside a **pnpm + Turborepo monorepo**.

| Package | Purpose |
|---|---|
| `apps/web` | Next.js 14 (App Router) — primary web application |
| `packages/core` | Core TypeScript types, Zod validators, constants, business rules |
| `packages/api` | Repository + service layer (Supabase queries, business logic) |
| `packages/ui` | Shared React UI components (Shadcn/Tailwind) |
| `packages/database` | SQL migrations, database types, seed data |
| `packages/integrations` | External service clients (Supabase, Sentry, PostHog) |

---

## Development

### Prerequisites

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.0.0

### Install Dependencies

```bash
pnpm install
```

### Environment Setup

Create `apps/web/.env.local` and fill in the required values from your Supabase project and other services.
See [docs/env.md](./docs/env.md) for the full list of environment variables.

### Run Development Server

```bash
pnpm dev
```

### Linting & Typechecking

```bash
pnpm lint
pnpm typecheck
```

### Build (Production)

```bash
pnpm build
```

---

## Database

Rosovia uses Supabase PostgreSQL with raw SQL migrations. No ORM is used.

### Apply Migrations

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### Seed Categories

```bash
# Local/dev only — resets data
supabase db reset
```

### Generate TypeScript Types

After applying migrations, regenerate the TypeScript database types:

```bash
supabase gen types typescript --schema public \
  > packages/database/src/database.types.ts
```

> Always regenerate types after adding or altering migrations. Commit the updated `database.types.ts`.

See [`docs/database.md`](./docs/database.md) for the detailed schema reference.

---

## Migration History

All migrations are in `packages/database/supabase/migrations/`.

| File | Purpose |
|---|---|
| `001_foundation.sql` | `profiles`, `categories` tables, triggers, RLS |
| `002_creator_profiles.sql` | `creator_profiles` table, slug, RLS |
| `003_listings.sql` | `listings` table, 6 listing types, RLS |
| `004_media_assets.sql` | `media_assets` table, Cloudflare R2 integration, RLS |
| `005_explore_search_indexes.sql` | `pg_trgm` extension, GIN trigram indexes for search |
| `006_inquiries.sql` | `inquiries` table, message threading, RLS |
| `007_custom_orders.sql` | `custom_orders` table, quote flow, RLS |
| `008_orders.sql` | `orders` + `order_status_history` tables, RLS |
| `009_payments.sql` | `payments` table, Razorpay webhook state machine, RLS |
| `010_reviews.sql` | `reviews` table, rating trigger, unique constraints, RLS |
| `011_verification_requests.sql` | `verification_requests` table, creator eligibility, RLS |
| `012_reports_moderation.sql` | `reports` + `admin_actions` tables, immutable audit log, RLS |
| `013_admin_dashboard_support.sql` | Extended admin action types, 9 performance indexes |
| `014_admin_actions_category_target.sql` | Added `category` to `admin_actions` target types |
| `015_security_hardening.sql` | `is_admin()` helper, helper RPCs, enhanced RLS guards |
| `016_payment_order_transactions.sql` | Atomic payment + order update via security-definer RPC |
| `017_inventory_reservation.sql` | Stock reservation logic for listings |
| `018_financial_fields.sql` | `platform_fee`, `seller_amount` fields on orders |
| `019_refunds_disputes_payouts.sql` | `refund_requests`, `disputes`, `creator_payouts` tables, extended admin action constraints, RLS |
| `020_media_moderation_hardening.sql` | Stricter verification document media RLS policies |
| `021_business_rule_rpcs.sql` | Atomic security-definer RPCs for critical business flows |
| `022_media_protected_columns.sql` | Protected `is_private`, `storage_key` columns from client update |
| `023_admin_atomic_actions.sql` | Atomic admin moderation RPCs (suspend user, approve listing, etc.) |
| `024_search_optimization.sql` | Additional trigram + compound indexes for search performance |
| `025_messaging.sql` | `messages` table, conversation threading, RLS |
| `026_notifications.sql` | `notifications` table, event-driven notification system, RLS |
| `027_delivery_confirmation.sql` | `order_deliveries` table, delivery tracking, auto-sync trigger, RLS |
| `028_critical_rpc_fixes.sql` | SQL triggers and RLS repairs for security stability |
| `029_security_atomicity_fixes.sql` | Handled critical transaction boundaries |
| `030_security_audit_fixes.sql` | Immutable audit log protections and atomic status modifications |
| `031_payment_flow_fixes.sql` | Corrected Razorpay webhook status transition errors |
| `032_operational_simplification.sql` | Pruned legacy, unneeded analytics dependencies |
| `033_milestone_gates.sql` | Configured gates for custom order timelines |
| `034_search_improvements.sql` | Full-text stemmed English search plus GIN trigram indexes |
| `035_marketplace_kpis.sql` | Database views monitoring daily sales and active listings |
| `036_profiles_public_select_policy.sql` | RLS SELECT policy ensuring active user profile public visibility |
| `037_saved_items.sql` | `saved_listings` and `saved_creators` tables for bookmarking |
| `038_creator_collections.sql` | `creator_collections` and `collection_items` for creator showcases |
| `039_notifications_hardening.sql` | Secure database policies for persistent user alerts |
| `040_search_sorting_fixes.sql` | Corrected Postgres search average rating sorting logic |
| `041_search_trust_fields.sql` | Added creator verification and rating metrics returns to search RPC |

> **Apply order matters.** Always apply migrations in numeric order from 001 to the latest.

---

## Current Status

- ✅ **Steps 1–3: Foundation & Monorepo** — pnpm + Turborepo, Next.js App Router, shared packages, placeholder routes.
- ✅ **Step 4: Database Foundation** — `profiles`, `categories`, RLS, 9 category seeds.
- ✅ **Step 5: Authentication** — Signup, login, logout, password reset, session middleware, profile auto-creation, role-based routing.
- ✅ **Step 6: Creator Profile** — `creator_profiles` table, onboarding, edit, public profile pages, slug generation, verification badge, rating summary.
- ✅ **Step 7: Listings** — `listings` table, 6 listing types, draft/pending/approved/archived status flow, creator dashboard, public `/listings` and `/listings/[slug]`.
- ✅ **Step 8: Media Upload** — `media_assets`, Cloudflare R2 integration, presigned PUT URL flow, file validation, public/private media separation, signed admin read URLs, protected columns.
- ✅ **Step 9: Explore / Search** — PostgreSQL ILIKE + GIN trigram index search, query-param filters, pagination across `/explore`, `/categories`, `/listings`, `/creators`.
- ✅ **Step 10: Inquiry System** — `inquiries` table, buyer/creator dashboards, inquiry form on creator and listing pages.
- ✅ **Step 11: Custom Orders** — `custom_orders` table, full status flow (requested → quoted → accepted), buyer/creator dashboards.
- ✅ **Step 12: Orders** — `orders` + `order_status_history`, order creation from listings and custom orders, fulfillment status flow, buyer/creator dashboards and detail pages.
- ✅ **Step 13: Payments** — `payments` table, Razorpay Checkout integration (REST, no SDK), HMAC-SHA256 webhook signature verification, idempotency via `webhook_event_id`, atomic payment/order update via security-definer RPC.
- ✅ **Step 14: Reviews** — `reviews` table, rating recalculation trigger, buyer submission eligibility, `ReviewForm`/`ReviewCard` components.
- ✅ **Step 15: Verification** — `verification_requests` table, admin approve/reject with `is_verified` + `verification_level` update, private document upload.
- ✅ **Step 16: Reports / Moderation** — `reports` + `admin_actions` tables, immutable audit log, buyer report form, admin moderation with side-effects.
- ✅ **Step 17: Admin Dashboard** — 11 dedicated admin pages (Overview, Users, Creators, Categories CRUD, Listings, Verification, Reports, Reviews, Orders, Payments, Audit Logs), AdminLayout.
- ✅ **Step 18: Analytics & Monitoring** — PostHog analytics (browser-only), Sentry error tracking (client/server/edge), `/api/health` endpoint.
- ✅ **Step 19: Security Hardening** — `is_admin()` helper, atomic RPC wrappers, enhanced RLS guards, media column protection.
- ✅ **Step 20: Messaging** — `messages` table, real-time conversation threading, buyer/creator message dashboards.
- ✅ **Step 21: Notifications** — `notifications` table, event-driven system, per-user notification inbox, notification bell in header.
- ✅ **Step 22: Deliveries, Bookmarks, Showcases, Security Hardening, and Rate-Limiting** — Completed order deliveries tracking and triggers; implemented saved items bookmarks and creator showcases; hardened message security and inquiry/custom order validations; wired persistent notifications bell; surfaced ratings and verification badges; optimized PostgreSQL search average rating sorting and RPC trust returns; integrated application-layer IP-based rate-limiting middleware (100 requests/minute) with standard HTTP quota headers; verified everything with a comprehensive automated Vitest test suite (**218 passing tests**) and Next.js production builds.

---

## Documentation

| Doc | Description |
|---|---|
| [docs/env.md](./docs/env.md) | All required environment variables |
| [docs/security.md](./docs/security.md) | Security architecture and hardening |
| [docs/payments.md](./docs/payments.md) | Razorpay payment flow, webhooks, idempotency |
| [docs/media-upload.md](./docs/media-upload.md) | Cloudflare R2 media upload flow |
| [docs/orders.md](./docs/orders.md) | Order lifecycle and status transitions |
| [docs/database.md](./docs/database.md) | Database schema reference |
| [docs/production-readiness.md](./docs/production-readiness.md) | Pre-production deployment checklist |
| [docs/deployment/vercel-supabase-deployment.md](./docs/deployment/vercel-supabase-deployment.md) | Step-by-step Vercel + Supabase deployment |
| [docs/explore-search.md](./docs/explore-search.md) | Search and explore implementation |
| [docs/analytics-monitoring.md](./docs/analytics-monitoring.md) | PostHog + Sentry setup |
| [docs/verification.md](./docs/verification.md) | Creator verification workflow |
| [docs/authentication.md](./docs/authentication.md) | Auth flows, middleware, session management |
| [docs/feature-roadmap.md](./docs/feature-roadmap.md) | Roadmap for MVP and future platform expansion |

---

## Production Status

**Rosovia is ready for staging and pre-production release.** See [`docs/production-readiness.md`](./docs/production-readiness.md) for the checklist of remaining platform tasks (load testing, Sentry routing alerts) before public live launch.
