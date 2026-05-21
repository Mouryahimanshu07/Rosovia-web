# Module 9: Custom Orders

Rosovia Module 9 implements the Custom Orders workflow — buyers can request personalized work from creators, creators can review and quote, and buyers can accept or cancel. This module stops at the accepted state; actual order creation and payment are Module 10 and 11.

---

## Scope

| Area | Status |
|---|---|
| `public.custom_orders` table | ✅ Migration 007 |
| RLS policies (7 policies) | ✅ Implemented |
| Core types | ✅ `packages/core/src/types/custom-order.ts` |
| Zod validators (create, quote, status update, list params) | ✅ `packages/core/src/validators/custom-order.ts` |
| Repository layer | ✅ `packages/api/src/custom-orders/custom-order.repository.ts` |
| Service layer | ✅ `packages/api/src/custom-orders/custom-order.service.ts` |
| Buyer server actions | ✅ `apps/web/src/app/dashboard/buyer/custom-orders/actions.ts` |
| Creator server actions | ✅ `apps/web/src/app/dashboard/creator/custom-orders/actions.ts` |
| `CustomOrderForm` component | ✅ `apps/web/src/components/custom-order/custom-order-form.tsx` |
| `CustomOrderQuoteForm` component | ✅ `apps/web/src/components/custom-order/custom-order-quote-form.tsx` |
| `CustomOrderStatusBadge` component | ✅ `apps/web/src/components/custom-order/custom-order-status-badge.tsx` |
| `CustomOrderCard` component | ✅ `apps/web/src/components/custom-order/custom-order-card.tsx` |
| `/creators/[slug]` — Custom Order CTA | ✅ Updated |
| `/listings/[slug]` — Custom Order CTA | ✅ Updated (only if `custom_order_available=true`) |
| `/dashboard/buyer/custom-orders` page | ✅ Implemented |
| `/dashboard/creator/custom-orders` page | ✅ Implemented |

---

## Database Table: `public.custom_orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `buyer_id` | uuid | FK → `profiles(id)` ON DELETE CASCADE |
| `creator_id` | uuid | FK → `creator_profiles(id)` ON DELETE CASCADE |
| `listing_id` | uuid | Nullable, FK → `listings(id)` ON DELETE SET NULL |
| `category_id` | uuid | FK → `categories(id)` (not null) |
| `title` | text | 3–160 chars |
| `description` | text | 20–4000 chars |
| `reference_media_id` | uuid | Nullable, FK → `media_assets(id)` ON DELETE SET NULL |
| `budget_min` | numeric | Nullable, ≥ 0 |
| `budget_max` | numeric | Nullable, ≥ 0, ≥ budget_min if both set |
| `deadline` | date | Nullable |
| `delivery_city` | text | Nullable, ≤ 80 chars |
| `delivery_state` | text | Nullable, ≤ 80 chars |
| `creator_quote_amount` | numeric | Nullable, ≥ 0 — set by creator only |
| `creator_quote_note` | text | Nullable, ≤ 2000 chars — set by creator only |
| `status` | text | Default `'requested'` |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-updated via trigger |
| `deleted_at` | timestamptz | Soft-delete |

### DB Status Values (for future compatibility)

All possible statuses stored in DB: `requested`, `creator_reviewing`, `quoted`, `accepted`, `rejected`, `payment_pending`, `paid`, `in_progress`, `delivered`, `completed`, `cancelled`, `disputed`.

**Module 9 only uses:** `requested`, `creator_reviewing`, `quoted`, `accepted`, `rejected`, `cancelled`.

---

## Custom Order Status Flow (Module 9)

```
[Buyer Submits Request]
        │
        ▼
   REQUESTED ─── Creator Rejects ──────────────────► REJECTED (terminal)
        │
        │  Creator marks reviewing
        ▼
CREATOR_REVIEWING ─── Creator Rejects ──────────────► REJECTED
        │
        │  Creator submits quote (amount + note)
        ▼
    QUOTED ─── Creator Rejects ────────────────────► REJECTED
        │  │
        │  └─── Buyer Cancels ───────────────────► CANCELLED (terminal)
        │
        │  Buyer accepts quote
        ▼
   ACCEPTED ── (Module 10 will create order row here)
        │
        ... (Module 10+)
```

| Status | Who Sets It | Meaning |
|---|---|---|
| `requested` | System (on create) | New request, awaiting creator action |
| `creator_reviewing` | Creator | Creator has acknowledged and is reviewing |
| `quoted` | Creator | Creator has submitted a quote |
| `accepted` | Buyer | Buyer accepts the quote — ready for Module 10 |
| `rejected` | Creator | Creator declines the request |
| `cancelled` | Buyer or Creator | Cancelled before payment stage |

---

## RLS Policies

| Policy | Actor | Operation | Key Condition |
|---|---|---|---|
| Buyer can read own | Buyer | SELECT | `buyer_id` matches auth user, `deleted_at IS NULL` |
| Buyer can create own | Buyer | INSERT | `buyer_id` matches auth user, profile active, `status='requested'`, quote fields null |
| Buyer can update own (limited) | Buyer | UPDATE | status in (requested, creator_reviewing, quoted) → new status in (accepted, cancelled) |
| Creator can read assigned | Creator | SELECT | `creator_id` matches auth creator, profile active, `deleted_at IS NULL` |
| Creator can update assigned (limited) | Creator | UPDATE | status in (requested, creator_reviewing, quoted) → new status in (creator_reviewing, quoted, rejected, cancelled) |
| Admin can read all | Admin | SELECT | `is_admin()` |
| Admin can update all | Admin | UPDATE | `is_admin()` |

> **Note:** Field-level immutability (buyer_id, creator_id, listing_id, category_id, title, description, reference_media_id, budget fields after creation) is enforced in the **service layer** — not only in RLS.

---

## Service / Repository Flow

```
Client Component
  │
  │  calls
  ▼
Server Action (apps/web/src/app/dashboard/.../actions.ts)
  │  validates with Zod
  │  calls
  ▼
Service (packages/api/src/custom-orders/custom-order.service.ts)
  │  auth check, business rules, field protection
  │  calls
  ▼
Repository (packages/api/src/custom-orders/custom-order.repository.ts)
  │  Supabase query (RLS enforced)
  ▼
public.custom_orders (PostgreSQL)
```

---

## Buyer Custom Order Request Flow

1. Buyer navigates to `/creators/[slug]` (if creator has `primary_category_id`) or `/listings/[slug]` (if `custom_order_available=true`)
2. If **authenticated**: `CustomOrderForm` is rendered with `creatorId` and `categoryId` from server data
3. If **unauthenticated**: Sign-in CTA links to `/login?redirected_from=...`
4. Buyer fills in: title, description, optional budget range, deadline, delivery location
5. Submit → `createCustomOrderAction` → `createCurrentUserCustomOrder` service
6. Service validates: creator exists and active, category active, listing approved (if provided), buyer ≠ creator, reference media belongs to buyer (if provided)
7. Row inserted with `status='requested'`, quote fields null
8. Buyer sees success state with link to `/dashboard/buyer/custom-orders`

---

## Creator Quote Flow

1. Creator navigates to `/dashboard/creator/custom-orders`
2. New requests appear with status `requested`
3. Creator can click **"Mark as Reviewing"** → status becomes `creator_reviewing`
4. Creator fills in `CustomOrderQuoteForm` (quote amount + optional note)
5. Submit → `quoteCustomOrderAction` → `quoteCurrentCreatorCustomOrder` service
6. Service validates: creator owns this order, status is quotable (requested or creator_reviewing)
7. Row updated: `status='quoted'`, `creator_quote_amount`, `creator_quote_note` set
8. Creator dashboard reflects the new quoted status

---

## Buyer Accept / Cancel Flow

1. Buyer navigates to `/dashboard/buyer/custom-orders`
2. Quoted orders show an **"Accept Quote"** button and a **"Cancel"** button
3. **Accept Quote** → `acceptQuoteAction` → `acceptCurrentBuyerCustomOrderQuote`
   - Validates: order exists, belongs to buyer, status is `quoted`, quote amount is not null
   - Updates: `status='accepted'`
   - Module 10 will react to this status to create an order row
4. **Cancel** → `cancelCustomOrderAsBuyerAction` → `cancelCurrentBuyerCustomOrder`
   - Validates: status in (requested, creator_reviewing, quoted)
   - Updates: `status='cancelled'`

---

## Security Rules

- `buyer_id` always resolved server-side from the authenticated session — client cannot supply it
- `creatorId`, `listingId`, `categoryId` on public pages come from server-fetched page data — client cannot override
- Creator cannot change `buyer_id`, `creator_id`, `listing_id`, `category_id`, `title`, `description`, `reference_media_id`, or budget fields — enforced in service layer
- Buyer can only set `status ∈ (accepted, cancelled)` — enforced in RLS and service
- Creator can only set `status ∈ (creator_reviewing, quoted, rejected, cancelled)` — enforced in RLS and service
- No service-role key in any public action

---

## Intentionally NOT Implemented (Module 9)

- Order table creation (Module 10)
- Payment flow (Module 11)
- Razorpay integration
- Payment status (`payment_pending`, `paid`)
- Order fulfillment statuses (`in_progress`, `delivered`, `completed`)
- Disputes (`disputed`)
- Real-time updates
- Email notifications
- Reference media upload UI (field supported in DB/service, UI deferred)
- Admin custom order management UI
- Reviews and ratings (Module 12)
- Verification workflow (Module 13)

---

## How to Apply Migration

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration file is: `packages/database/supabase/migrations/007_custom_orders.sql`

---

## Next Module

**Module 10: Orders** — When a custom order is `accepted`, create an order row in a new `public.orders` table that tracks fulfillment progress and links to payments.
