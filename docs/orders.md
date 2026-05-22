# Orders — Rosovia

## Overview

The Rosovia order system manages the full lifecycle of buyer-creator transactions — from order creation through payment, fulfillment, delivery, and completion (or cancellation/dispute).

---

## Order Sources

Orders can be created from two sources:

| Source | Table | Condition |
|---|---|---|
| Approved listing | `listings` | `status = approved`, `price > 0`, `stock > 0` (if tracked), buyer ≠ creator |
| Accepted custom order | `custom_orders` | `status = accepted`, `creator_quote_amount > 0`, belongs to buyer |

In both cases, the initial order state is:
- `order_status = payment_pending`
- `payment_status = created`

---

## Database Tables

### `public.orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `buyer_id` | uuid | FK → `profiles.id` ON DELETE CASCADE |
| `creator_id` | uuid | FK → `creator_profiles.id` ON DELETE CASCADE |
| `listing_id` | uuid | FK → `listings.id` SET NULL, nullable |
| `custom_order_id` | uuid | FK → `custom_orders.id` SET NULL, nullable |
| `amount` | numeric | Total order amount (≥ 0) |
| `platform_fee` | numeric | Platform fee (≥ 0, currently always 0) |
| `seller_amount` | numeric | Amount creator receives (≥ 0) |
| `currency` | text | Default `INR` |
| `order_status` | text | See status list below |
| `payment_status` | text | See payment status below |
| `delivery_status` | text | Nullable, synced from `order_deliveries` trigger |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

**Constraints:**
- `order_status` IN: `draft`, `requested`, `accepted`, `payment_pending`, `paid`, `in_progress`, `shipped`, `delivered`, `completed`, `cancelled`, `disputed`, `refunded`
- `payment_status` IN: `created`, `pending`, `paid`, `failed`, `refunded`, `partially_refunded`
- Exactly one of `listing_id` or `custom_order_id` must be non-null
- Partial unique index on `custom_order_id WHERE custom_order_id IS NOT NULL` — one order per accepted custom order

### `public.order_status_history`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → `orders.id` ON DELETE CASCADE |
| `old_status` | text | Nullable (null on creation) |
| `new_status` | text | Required |
| `changed_by` | uuid | FK → `profiles.id` SET NULL |
| `note` | text | Optional, max 1000 chars |
| `created_at` | timestamptz | Auto |

### `public.order_deliveries`

Added in migration `027_delivery_confirmation.sql`. Tracks physical/digital delivery state separately from order status.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → `orders.id`, UNIQUE |
| `creator_id` | uuid | FK → `creator_profiles.id` |
| `buyer_id` | uuid | FK → `profiles.id` |
| `delivery_type` | text | `manual` (default) |
| `tracking_reference` | text | Optional tracking number / reference |
| `delivery_note` | text | Creator's delivery notes |
| `shipped_at` | timestamptz | Set when creator marks shipped |
| `delivered_at` | timestamptz | Set when creator marks delivered |
| `buyer_confirmed_at` | timestamptz | Set when buyer confirms receipt |
| `status` | text | `pending` / `shipped` / `delivered` / `buyer_confirmed` / `disputed` / `cancelled` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

A PostgreSQL trigger (`sync_order_delivery_on_status_change`) automatically creates or updates the `order_deliveries` record whenever `orders.order_status` changes to `shipped`, `delivered`, `completed`/`buyer_confirmed`, `cancelled`, or `disputed`.

---

## Full Order Status Flow

```
ORDER CREATED
  └─ payment_pending  ←── initial state for all orders

PAYMENT (Module 11 — Razorpay webhook)
  payment_pending ──► paid          ← payment.captured webhook
  payment_pending ──► cancelled     ← buyer cancels before paying

FULFILLMENT (creator)
  paid ─────────────► accepted
  accepted ──────────► in_progress
  in_progress ───────► shipped
  shipped ───────────► delivered

COMPLETION (buyer)
  delivered ─────────► completed    ← buyer confirms receipt

DISPUTES / EXCEPTIONS
  any active status ─► disputed
  any active status ─► cancelled
  completed + paid ──► refunded     ← future: after refund processed
```

### Payment Status Transitions

| Event | `payment_status` | Triggered By |
|---|---|---|
| Order created | `created` | Order service (buyer/creator) |
| Razorpay checkout initiated | `pending` | `createPaymentForOrderAction` |
| Webhook: `payment.captured` | `paid` | Webhook handler (service-role) |
| Webhook: `payment.failed` | `failed` | Webhook handler (service-role) |
| Refund processed | `refunded` | Manual admin (future: Razorpay API) |

---

## Delivery Confirmation Flow

After an order reaches `delivered` status:

1. Buyer visits order detail page (`/dashboard/buyer/orders/[id]`)
2. Sees delivery tracking info from `order_deliveries` record
3. Clicks **Confirm Receipt** → calls `buyerConfirmDelivery` service
4. `orders.order_status` → `completed`
5. `order_deliveries.status` → `buyer_confirmed`, `buyer_confirmed_at` set

The `order_deliveries` record is automatically created and kept in sync with order status via the database trigger in migration 027.

---

## RLS Policies

### `public.orders` (8 policies)

| Policy | Operation | Who |
|---|---|---|
| Buyer reads own | SELECT | Buyer → profile join |
| Creator reads assigned | SELECT | Creator → `creator_profiles` join |
| Buyer creates listing order | INSERT | Buyer, `listing_id NOT NULL`, status = `payment_pending` |
| Buyer creates custom order | INSERT | Buyer, `custom_order_id NOT NULL`, status = `payment_pending` |
| Buyer cancels own | UPDATE | Payment not `paid`, order not in terminal states |
| Creator updates fulfillment | UPDATE | Creator active, new status in `accepted`/`in_progress`/`shipped`/`delivered`/`cancelled`/`disputed` |
| Admin reads all | SELECT | `public.is_admin()` |
| Admin updates all | UPDATE | `public.is_admin()` |

### `public.order_deliveries` (4 policies)

| Policy | Operation | Who |
|---|---|---|
| Buyer reads own | SELECT | `buyer_id` → current profile |
| Creator reads assigned | SELECT | `creator_id` → current creator profile |
| Creator updates delivery | UPDATE | Creator can update tracking, notes, delivery status |
| Admin reads/updates all | SELECT/UPDATE | `public.is_admin()` |

---

## Security Rules

- `buyer_id`, `creator_id`, `amount`, `platform_fee`, `seller_amount` are **never accepted from the client** — all derived server-side from authenticated session and database records.
- All client inputs validated with Zod before reaching the service layer.
- RLS enforces that buyers/creators only access their own orders.
- Service layer enforces valid state transitions before any DB update.
- `payment_status = paid` can only be set by the webhook handler (service-role client). No RLS policy allows this for normal users.

---

## What Is Not Yet Implemented

| Feature | Status |
|---|---|
| Stock decrement on order creation | ⚠️ Partial (reservation via migration 017, no UI for stock management) |
| Automated refund money movement | ❌ Manual only — see docs/payments.md |
| Automated creator payouts | ❌ Manual only |
| Real-time order status updates | ❌ Not implemented (requires WebSocket / Supabase Realtime) |
| Shipping provider integration | ❌ Not implemented |
| Invoice / receipt generation | ❌ Not implemented |
| Platform fee deduction | ❌ `platform_fee` field always 0 — no fee collection |
