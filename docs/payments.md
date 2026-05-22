# Payments — Rosovia

## Overview

Rosovia integrates with **Razorpay** for payment processing. The Razorpay webhook is the authoritative source of truth for all payment state changes — the client never directly marks a payment as paid.

---

## Payment Flow

```
Buyer clicks "Pay Now"
  └─ createPaymentForOrderAction (Next.js Server Action)
       ├─ Authenticate buyer (getUser)
       ├─ Validate: order belongs to buyer, order_status = payment_pending, amount > 0
       ├─ POST https://api.razorpay.com/v1/orders → { provider_order_id }
       ├─ INSERT public.payments  (status = pending)
       ├─ UPDATE public.orders    (payment_status = pending)
       └─ Return to client: { razorpayKeyId, providerOrderId, amountInPaise, currency }

Client (PayNowButton — browser)
  └─ Load checkout.razorpay.com/v1/checkout.js
       └─ new Razorpay({ order_id: providerOrderId, key: razorpayKeyId }).open()
            └─ Buyer completes payment in Razorpay modal

Razorpay → Rosovia (async, server-to-server)
  └─ POST /api/webhooks/razorpay  (x-razorpay-signature header)
       ├─ Read raw request body as text (before JSON parse — required for HMAC)
       ├─ Verify HMAC-SHA256 signature  →  invalid → 400
       ├─ Parse + validate webhook event schema
       ├─ Idempotency check (webhook_event_id + payment status)
       ├─ payment.captured:
       │    ├─ Verify amount matches expected (paise) from DB
       │    ├─ Call atomic RPC: process_razorpay_payment_capture (016_payment_order_transactions.sql)
       │    │    ├─ UPDATE public.payments  (status = paid, webhook_received = true)
       │    │    ├─ UPDATE public.orders    (payment_status = paid, order_status = paid)
       │    │    └─ INSERT public.order_status_history (note = "Payment captured by Razorpay")
       │    └─ Return 200
       └─ payment.failed:
            ├─ UPDATE public.payments  (status = failed, webhook_received = true)
            ├─ UPDATE public.orders    (payment_status = failed)
            └─ Return 200
```

---

## Atomic Payment Update (Security-Definer RPC)

The `payment.captured` webhook handler calls `process_razorpay_payment_capture` — a `SECURITY DEFINER` PostgreSQL RPC defined in migration `016_payment_order_transactions.sql`.

This RPC:
- Runs in a single atomic database transaction
- Updates `payments`, `orders`, and inserts `order_status_history` in one call
- Cannot be called directly by authenticated users (restricted to service-role context from the webhook handler)
- Prevents partial updates (e.g., payment marked paid but order not updated)

---

## Webhook Signature Verification

```typescript
// From /api/webhooks/razorpay/route.ts
const rawBody = await request.text();  // Read as text BEFORE any JSON.parse

const expectedSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest('hex');

// Constant-time comparison (prevents timing attacks)
if (expectedSignature !== receivedSignature) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
}
```

- Invalid signature → `400 Bad Request`
- Valid but unprocessable (non-fatal) → `200` (prevents Razorpay retries)
- Unexpected server error → `500` (Razorpay will retry)

---

## Idempotency

Duplicate webhooks are handled at multiple levels:

| Mechanism | How |
|---|---|
| `webhook_event_id` | Unique nullable column. Composed as `{event}:{provider_payment_id}`. Duplicate triggers a skip. |
| `provider_payment_id` | Unique index — prevents duplicate payment rows for the same Razorpay payment. |
| Status check | If `payment.status === 'paid'` on a `payment.captured` event, skip. |
| All duplicates | Return `200` to prevent Razorpay from retrying. |

---

## payments Table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → `orders.id` ON DELETE CASCADE |
| `provider` | text | `razorpay` (only supported value) |
| `provider_payment_id` | text | Razorpay payment ID — unique when set |
| `provider_order_id` | text | Razorpay order ID — unique when set |
| `provider_payment_link_id` | text | Reserved for future Payment Links |
| `amount` | numeric | Order amount in INR (≥ 0) |
| `currency` | text | Default `INR` |
| `status` | text | See status list below |
| `webhook_received` | boolean | `true` after webhook confirmation |
| `webhook_event_id` | text | Unique nullable idempotency key |
| `raw_payload` | jsonb | Raw webhook body (not forwarded to Sentry) |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

**Payment status values:** `created` · `pending` · `paid` · `failed` · `refunded` · `partially_refunded` · `cancelled`

---

## RLS Policies (5)

| Policy | Operation | Who |
|---|---|---|
| Buyer reads own | SELECT | Buyer via `orders.buyer_id` join |
| Creator reads assigned | SELECT | Creator via `orders.creator_id` + `creator_profiles` join |
| Buyer can create payment | INSERT | Buyer, status in `created`/`pending`, provider = `razorpay` |
| Admin reads all | SELECT | `public.is_admin()` |
| Admin updates all | UPDATE | `public.is_admin()` |

> **No RLS policy allows setting `payment_status = paid`.** Only the service-role webhook handler can do this via the atomic RPC.

---

## Inventory / Stock Reservation

Migration `017_inventory_reservation.sql` adds stock reservation logic for listing-based orders:

- When an order is created from a listing with `stock > 0`, the stock is decremented atomically.
- If payment fails, the reservation is released.
- If payment succeeds (webhook confirmed), the reservation is finalized.

This prevents overselling when multiple buyers try to purchase the same limited-stock listing simultaneously.

---

## Order Fulfillment After Payment

After `order_status = paid`, the fulfillment flow continues:

```
paid → accepted → in_progress → shipped → delivered → completed
```

- Creator actions: `accepted`, `in_progress`, `shipped`, `delivered`
- Buyer actions: `completed` (confirms receipt), `disputed`
- Each transition is recorded in `order_status_history`

---

## Amount Handling

```typescript
// Always convert to integer paise (1 INR = 100 paise)
const amountInPaise = Math.round(order.amount * 100);
// e.g. INR 999.99 → 99999 paise
```

The webhook verifies the captured amount matches the expected amount from the database. A mismatch (e.g., from a tampered client request) rejects the capture.

---

## Environment Variables

```env
RAZORPAY_KEY_ID=rzp_test_XXXX       # Returned from server action to client — publishable key
RAZORPAY_KEY_SECRET=XXXX            # SECRET — server only — never sent to client
RAZORPAY_WEBHOOK_SECRET=XXXX        # SECRET — webhook signature verification only
SUPABASE_SERVICE_ROLE_KEY=XXXX      # SECRET — webhook handler uses service-role client
```

---

## Security Rules

- `RAZORPAY_KEY_SECRET` is **never** returned to the client.
- `RAZORPAY_WEBHOOK_SECRET` is **never** returned to the client.
- `SUPABASE_SERVICE_ROLE_KEY` is **only** used in the webhook route handler (server-side).
- `PayNowButton` (client component) only receives: `razorpayKeyId`, `providerOrderId`, `amountInPaise`, `currency` — no secrets.
- The client Razorpay handler does **not** mark the payment as paid.
- No RLS policy allows authenticated users to set `payment_status = paid`.
- Amount always comes from the database, never from the client request.
- Buyer cannot pay for another user's order (enforced in service layer and RLS).
- `raw_payload` from the webhook body is stored in the database but is scrubbed from Sentry via `beforeSend`.

---

## Refunds (Foundation Only)

> ⚠️ **Current State**: The `refund_requests` table, TypeScript types, Zod validators, repository, service layer, and buyer dashboard page (`/dashboard/buyer/refunds`) are all implemented. However, **no actual Razorpay Refund API calls are made**. Refunds are a manual admin process at this stage.

When a buyer requests a refund:
1. A `refund_requests` row is created with `status = requested`
2. Admin reviews the request in the disputes/admin dashboard
3. Admin manually approves or rejects and logs the action to `admin_actions`
4. Actual money is returned manually (outside the system)

**Future work**: Integrate `POST https://api.razorpay.com/v1/payments/{id}/refund` to automate refund processing when a refund is approved.

---

## What Is Not Yet Implemented

| Feature | Notes |
|---|---|
| Automated refunds | Manual admin only — no Razorpay Refund API integration |
| Automated creator payouts | Manual only — no RazorpayX / bank transfer automation |
| Platform fee collection | `platform_fee` field exists but is always 0 — no fee deduction |
| Wallet / escrow | Not planned for current scope |
| Subscriptions | Not planned |
| Stripe / international payments | INR + Razorpay only |
| Payment invoices / receipts | Not implemented |
| Settlement reporting | Not implemented |
