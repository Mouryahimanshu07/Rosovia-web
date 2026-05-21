# Rosovia Module 10: Orders

## Scope

Module 10 implements the Orders foundation — tracking accepted custom work and listing purchases. Payments are **not** implemented here; that is Module 11.

---

## Database Tables

### `public.orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `buyer_id` | uuid | FK → `profiles.id` ON DELETE CASCADE |
| `creator_id` | uuid | FK → `creator_profiles.id` ON DELETE CASCADE |
| `listing_id` | uuid | FK → `listings.id` ON DELETE SET NULL, nullable |
| `custom_order_id` | uuid | FK → `custom_orders.id` ON DELETE SET NULL, nullable |
| `amount` | numeric | Total order amount (≥ 0) |
| `platform_fee` | numeric | Platform fee, default 0 (≥ 0) |
| `seller_amount` | numeric | What creator receives (≥ 0) |
| `currency` | text | Default `INR` |
| `order_status` | text | See status list below |
| `payment_status` | text | See payment status list below |
| `delivery_status` | text | Nullable, free text |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

**Constraints:**
- `order_status` must be one of: `draft`, `requested`, `accepted`, `payment_pending`, `paid`, `in_progress`, `shipped`, `delivered`, `completed`, `cancelled`, `disputed`, `refunded`
- `payment_status` must be one of: `created`, `pending`, `paid`, `failed`, `refunded`, `partially_refunded`
- `amount`, `platform_fee`, `seller_amount` must each be ≥ 0
- Exactly one of `listing_id` or `custom_order_id` must be non-null (source constraint)
- Partial unique index on `custom_order_id WHERE custom_order_id IS NOT NULL` — one order per accepted custom order

---

### `public.order_status_history`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → `orders.id` ON DELETE CASCADE |
| `old_status` | text | Nullable (null on creation) |
| `new_status` | text | Required |
| `changed_by` | uuid | FK → `profiles.id` ON DELETE SET NULL, nullable |
| `note` | text | Optional, max 1000 chars |
| `created_at` | timestamptz | Auto |

---

## Order Source Rules

### From an Approved Listing
- Listing must have `status = approved` and `deleted_at IS NULL`
- Listing must have a non-null, positive `price`
- If `stock` is not null, it must be > 0
- Linked creator profile must be active (base `profiles.status = active`)
- Buyer cannot order their own listing
- `amount = listing.price`, `currency = listing.currency`, `platform_fee = 0`, `seller_amount = amount`
- `listing_id = listing.id`, `custom_order_id = null`
- Initial `order_status = payment_pending`, `payment_status = created`

### From an Accepted Custom Order
- Custom order must have `status = accepted` and `deleted_at IS NULL`
- Custom order must belong to the current buyer (`buyer_id = profile.id`)
- `creator_quote_amount` must be non-null and > 0
- No existing order for this `custom_order_id` (enforced by partial unique index + service layer)
- `amount = creator_quote_amount`, `currency = INR`, `platform_fee = 0`, `seller_amount = amount`
- `custom_order_id = custom_order.id`, `listing_id = null`
- Initial `order_status = payment_pending`, `payment_status = created`

---

## Status Flow (Module 10)

```
ORDER CREATION
  └─ payment_pending  (initial state for both listing and custom order sources)

BUYER ACTIONS
  payment_pending ──► cancelled  (only if payment_status = created/pending)
  delivered ────────► completed  (buyer confirms receipt)
  any active ───────► disputed

CREATOR ACTIONS
  payment_pending ──► accepted
  accepted ─────────► in_progress
  in_progress ──────► shipped
  shipped ──────────► delivered
  any active ───────► cancelled (if allowed)
  any active ───────► disputed
```

> **Important:** `payment_status = paid`, `order_status = paid`, and `order_status = refunded` are **never set in Module 10**. Module 11 (Payments) will handle these transitions.

---

## Payment Status Explanation

| Status | Module | Meaning |
|---|---|---|
| `created` | 10+ | Order row exists, no payment initiated |
| `pending` | 10+ | Payment initiated, awaiting confirmation |
| `paid` | 11+ | Payment confirmed (Razorpay) |
| `failed` | 11+ | Payment failed |
| `refunded` | 11+ | Full refund issued |
| `partially_refunded` | 11+ | Partial refund issued |

---

## RLS Policies

### `public.orders` (8 policies)

| Policy | Operation | Condition |
|---|---|---|
| Buyer reads own | SELECT | `buyer_id` → current user profile, `deleted_at IS NULL` |
| Buyer creates listing order | INSERT | Buyer active, `listing_id NOT NULL`, `custom_order_id NULL`, status = `payment_pending` |
| Buyer creates custom order | INSERT | Buyer active, `custom_order_id NOT NULL`, `listing_id NULL`, status = `payment_pending` |
| Buyer cancels own | UPDATE | Payment not paid, status not in paid/in_progress/shipped/delivered/completed/refunded |
| Creator reads assigned | SELECT | Via `creator_profiles` join, creator active, `deleted_at IS NULL` |
| Creator updates fulfillment | UPDATE | Creator active, new status in accepted/in_progress/shipped/delivered/cancelled/disputed, no paid/refunded payment_status |
| Admin reads all | SELECT | `public.is_admin()` |
| Admin updates all | UPDATE | `public.is_admin()` |

### `public.order_status_history` (5 policies)

| Policy | Operation | Condition |
|---|---|---|
| Buyer reads own order history | SELECT | Via `orders` join, `buyer_id` → current user |
| Creator reads assigned order history | SELECT | Via `orders` + `creator_profiles` join |
| User inserts own history | INSERT | `changed_by` = current user profile, order belongs to current user as buyer or creator |
| Admin reads all | SELECT | `public.is_admin()` |
| Admin insert/update | INSERT/UPDATE | `public.is_admin()` |

---

## Service / Repository Flow

```
Client Component
  └─ Server Action (apps/web/src/app/actions/orders.ts)
       └─ Zod validation (packages/core/src/validators/order.ts)
            └─ Order Service (packages/api/src/orders/order.service.ts)
                 ├─ Profile resolution (getProfileByAuthUserId)
                 ├─ Business rule validation
                 └─ Order Repository (packages/api/src/orders/order.repository.ts)
                      └─ Supabase client (RLS enforced)
```

---

## Create Order from Listing Flow

1. Buyer visits `/listings/[slug]`
2. Sees "Request Purchase" button (only if `listing.price != null` and authenticated)
3. Clicks → `createOrderFromListingAction({ listingId })`
4. Server action validates schema → calls `createOrderFromApprovedListing()`
5. Service:
   - Fetches listing, validates approved + price > 0 + stock > 0
   - Validates creator is active
   - Checks buyer ≠ creator
   - Inserts `orders` row with `order_status = payment_pending`
   - Inserts `order_status_history` row (old_status = null, new_status = payment_pending)
6. Redirects to `/dashboard/buyer/orders/{orderId}`

---

## Create Order from Accepted Custom Order Flow

1. Buyer visits `/dashboard/buyer/custom-orders`
2. Sees "Create Order" button next to accepted custom orders
3. Clicks → `createOrderFromCustomOrderAction({ customOrderId })`
4. Server action validates schema → calls `createOrderFromAcceptedCustomOrder()`
5. Service:
   - Fetches custom order, validates `status = accepted` and belongs to buyer
   - Validates `creator_quote_amount > 0`
   - Checks no existing order for this custom_order_id
   - Inserts `orders` row with `order_status = payment_pending`
   - Inserts `order_status_history` row
6. Redirects to `/dashboard/buyer/orders/{orderId}`

---

## Buyer Dashboard Flow

Route: `/dashboard/buyer/orders`

- Requires authenticated user with `profile.status = active`
- Lists all buyer's non-deleted orders with status badges
- Each card shows: source (listing/custom order), creator name, amount, order status, payment status
- Actions per card: Cancel (if payment_pending), Mark Completed (if delivered), Raise Dispute
- "View details →" links to `/dashboard/buyer/orders/[id]`

Detail route: `/dashboard/buyer/orders/[id]`
- Full order overview + status history timeline

---

## Creator Dashboard Flow

Route: `/dashboard/creator/orders`

- Requires `profile.role = creator` + `profile.status = active`
- Lists all assigned orders (by `creator_id`)
- Each card shows: buyer name, source, amount, order/payment status
- Actions per card: Accept, Start Work, Mark Shipped, Mark Delivered, Raise Dispute
- "View details →" links to `/dashboard/creator/orders/[id]`

Detail route: `/dashboard/creator/orders/[id]`
- Full order overview with earnings breakdown + status history

---

## Security Rules

- **Server-side only**: `buyerId`, `creatorId`, `amount`, `platformFee`, `sellerAmount` are **never accepted from the client**. All are resolved server-side.
- **Zod validation**: All client inputs are validated before reaching the service layer.
- **RLS enforcement**: Row-level security ensures buyers/creators can only access their own data.
- **Status guards**: Service layer enforces valid state transitions before any DB update.
- **Payment guard**: `payment_status = paid` and `order_status = paid/refunded` cannot be set in Module 10.
- **History limitation**: Supabase JS client does not support multi-statement transactions natively. History inserts run after the order update. If history insert fails, it is logged as a warning (non-fatal). A future enhancement could use a Supabase RPC/database function to wrap both in a transaction.

---

## What Is Intentionally NOT Implemented

- Razorpay / payment gateway integration
- Payment checkout flow
- Payment webhooks
- `payment_status = paid/failed/refunded`
- `order_status = paid/refunded`
- Escrow / wallet / automated payouts
- Stock decrement on order creation
- Shipping provider integration
- Reviews / ratings
- Admin CRUD orders UI
- Notifications
- Real-time order updates

---

## Next Module: Module 11 — Payments

Module 11 will implement:
- Razorpay payment link creation
- Payment verification webhooks
- `payment_status` → `paid` / `failed` / `refunded` transitions
- `order_status` → `paid` transition
- Escrow and payout logic
- Payment records table

---

## How to Apply Migration

```bash
# From project root
supabase db push

# Or directly push the file
supabase migration up
```

Migration file: `packages/database/supabase/migrations/008_orders.sql`
