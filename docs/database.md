# Database Architecture — Rosovia

## Technology Decision

Rosovia uses **Supabase PostgreSQL** as its primary database. All schema changes are managed as raw SQL migration files in `packages/database/supabase/migrations/`. No ORM (Prisma/Drizzle) is used — all queries go through the Supabase JS client with PostgREST or via security-definer RPCs for atomic operations.

---

## Applying Migrations

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push all pending migrations in numeric order
supabase db push
```

Apply migrations in order from `001` to the latest. **Order is critical** — later migrations reference tables created in earlier ones.

---

## Generating TypeScript Types

After applying all migrations, regenerate the database types:

```bash
supabase gen types typescript --schema public \
  > packages/database/src/database.types.ts
```

Commit the result. The `@rosovia/database` package exports these types to all other packages.

---

## Migration Index

| File | Tables / Changes |
|---|---|
| `001_foundation.sql` | `profiles`, `categories`, `set_updated_at` trigger function, role/status constraints |
| `002_creator_profiles.sql` | `creator_profiles`, slug generation, rating fields, `is_verified` |
| `003_listings.sql` | `listings`, 6 listing types, draft/pending/approved/archived status flow |
| `004_media_assets.sql` | `media_assets`, Cloudflare R2 paths, public/private separation |
| `005_explore_search_indexes.sql` | `pg_trgm` extension, GIN trigram indexes, compound search indexes |
| `006_inquiries.sql` | `inquiries`, message threading, status flow |
| `007_custom_orders.sql` | `custom_orders`, quote flow, requested/quoted/accepted/rejected/cancelled statuses |
| `008_orders.sql` | `orders`, `order_status_history`, full fulfillment status flow, RLS |
| `009_payments.sql` | `payments`, Razorpay status machine, webhook idempotency, RLS |
| `010_reviews.sql` | `reviews`, `recalculate_creator_rating_trigger`, per-order unique constraint |
| `011_verification_requests.sql` | `verification_requests`, eligibility constraints, one-pending-per-type index |
| `012_reports_moderation.sql` | `reports`, `admin_actions`, immutable audit log, action_type constraint |
| `013_admin_dashboard_support.sql` | Extended `admin_actions` action types, 9 performance indexes for admin queries |
| `014_admin_actions_category_target.sql` | Added `category` to `admin_actions.target_type` constraint |
| `015_security_hardening.sql` | `public.is_admin()` helper, security-definer utility RPCs, enhanced RLS |
| `016_payment_order_transactions.sql` | `process_razorpay_payment_capture` atomic RPC (SECURITY DEFINER) |
| `017_inventory_reservation.sql` | Stock reservation for listing-based orders |
| `018_financial_fields.sql` | `platform_fee`, `seller_amount` columns on `orders` |
| `019_refunds_disputes_payouts.sql` | `refund_requests`, `disputes`, `creator_payouts`, extended `admin_actions` action types |
| `020_media_moderation_hardening.sql` | Stricter RLS for verification document media |
| `021_business_rule_rpcs.sql` | Atomic security-definer RPCs: `create_refund_request_atomic`, `create_dispute_atomic`, `create_creator_payout_for_order` |
| `022_media_protected_columns.sql` | Protected `is_private` and `storage_key` columns (cannot be updated by users) |
| `023_admin_atomic_actions.sql` | Atomic admin RPCs: `admin_suspend_user_atomic`, `admin_approve_listing_atomic`, etc. |
| `024_search_optimization.sql` | Additional compound + trigram indexes for search performance |
| `025_messaging.sql` | `messages`, conversation threading, RLS |
| `026_notifications.sql` | `notifications`, event-driven inbox, per-user read state, RLS |
| `027_delivery_confirmation.sql` | `order_deliveries`, `sync_order_delivery_on_status_change` trigger, RLS |

---

## Core Tables

### `public.profiles`

Base profile for every Rosovia user (buyer, creator, or admin).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `auth_user_id` | uuid | FK → `auth.users(id)`, unique, cascade delete |
| `full_name` | text | Nullable |
| `username` | text | Unique, nullable |
| `email` | text | Nullable |
| `avatar_url` | text | Nullable |
| `role` | text | `buyer` / `creator` / `admin`, default `buyer` |
| `city`, `state`, `country` | text | Location; `country` default `India` |
| `status` | text | `active` / `suspended` / `deleted`, default `active` |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | Standard timestamps |

### `public.categories`

9 categories seeded in `seed.sql`:

| Category | Type |
|---|---|
| Handmade Gifts / Handmade Products | `product` |
| Painting / Sketching / Digital Art | `learning` |
| Pottery / Clay Art | `product` |
| Coding / Web Development | `service` |
| Graphic Design / Logo / UI Design | `service` |
| Dance / Music / Singing | `performance` |
| Photography / Videography | `service` |
| Teaching / Mentorship | `learning` |
| Fashion / Handmade Clothes / Jewellery | `product` |

### Other Key Tables

| Table | Migration | Purpose |
|---|---|---|
| `creator_profiles` | 002 | Extended creator metadata, rating, verification level |
| `listings` | 003 | Products/services offered by creators |
| `media_assets` | 004 | R2-backed media records (images, videos, documents) |
| `inquiries` | 006 | Buyer → creator message inquiries |
| `custom_orders` | 007 | Custom work requests and quotes |
| `orders` | 008 | Order transactions |
| `order_status_history` | 008 | Immutable order status audit trail |
| `payments` | 009 | Razorpay payment records |
| `reviews` | 010 | Buyer reviews on completed orders |
| `verification_requests` | 011 | Creator identity/skill verification submissions |
| `reports` | 012 | User content reports |
| `admin_actions` | 012 | Immutable admin moderation audit log |
| `refund_requests` | 019 | Buyer refund requests |
| `disputes` | 019 | Buyer/creator formal dispute records |
| `creator_payouts` | 019 | Creator earnings settlement records |
| `messages` | 025 | Buyer-creator messaging |
| `notifications` | 026 | In-app notification inbox |
| `order_deliveries` | 027 | Delivery tracking and buyer confirmation |

---

## RLS Architecture

RLS is enabled on **all** public tables. The core access model:

- Users read and modify only their own data
- Creators read data related to their active creator profile
- Admins can read and update all data via `public.is_admin()`
- Service-role client (server-only) bypasses RLS for trusted webhook and admin operations

See [docs/security.md](./security.md) for the full security architecture.

---

## Triggers

| Trigger | Table | What It Does |
|---|---|---|
| `set_updated_at` | All tables | Auto-updates `updated_at` on row change |
| `recalculate_creator_rating_trigger` | `reviews` | Recalculates `rating_avg` and `rating_count` on `creator_profiles` after review INSERT/UPDATE/DELETE |
| `create_profile_for_user` | `auth.users` | Auto-creates a `profiles` row on new Supabase Auth user signup |
| `sync_order_delivery_on_status_change` | `orders` | Auto-creates/updates `order_deliveries` row when `order_status` transitions to `shipped`, `delivered`, etc. |

---

## Seeded Categories

Run via `packages/database/supabase/seed.sql`:

```bash
# Local only — resets all data
supabase db reset

# Or execute seed.sql in Supabase SQL Editor for production seed
```
