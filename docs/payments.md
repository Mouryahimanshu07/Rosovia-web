# Rosovia Module 11: Payments

## Scope

Module 11 connects existing orders (Module 10) to Razorpay, enabling buyers to pay for their orders. The webhook is the authoritative source of truth for all payment state changes.

---

## Razorpay Checkout Flow

```
Buyer clicks "Pay Now"
  └─ createPaymentForOrderAction (Server Action)
       ├─ Validate: order belongs to buyer, order_status = payment_pending, amount > 0
       ├─ POST https://api.razorpay.com/v1/orders  →  provider_order_id
       ├─ INSERT public.payments  (status = pending)
       ├─ UPDATE public.orders    (payment_status = pending)
       └─ Return: { razorpayKeyId, providerOrderId, amountInPaise, currency, orderId, appPaymentId }

Client (PayNowButton)
  └─ Load checkout.razorpay.com/v1/checkout.js
       └─ new Razorpay({ order_id: providerOrderId, key: razorpayKeyId, ... }).open()
            └─ Buyer completes payment in Razorpay modal

Razorpay (async)
  └─ POST /api/webhooks/razorpay  (x-razorpay-signature header)
       ├─ Read raw body as text
       ├─ Verify HMAC-SHA256 signature   →  invalid → 400
       ├─ Parse JSON + validate schema
       ├─ Idempotency: check webhook_event_id / payment status
       ├─ payment.captured:
       │    ├─ Verify amount matches expected (paise)
       │    ├─ UPDATE public.payments  (status = paid, webhook_received = true)
       │    ├─ UPDATE public.orders    (payment_status = paid, order_status = paid)
       │    └─ INSERT public.order_status_history  (old → paid, note = "Payment captured by Razorpay")
       ├─ payment.failed:
       │    ├─ UPDATE public.payments  (status = failed)
       │    └─ UPDATE public.orders    (payment_status = failed, order_status unchanged)
       └─ Return 200
```

---

## payments Table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → `orders.id` ON DELETE CASCADE |
| `provider` | text | `razorpay` (only) |
| `provider_payment_id` | text | Razorpay payment ID, nullable, unique when set |
| `provider_order_id` | text | Razorpay order ID, nullable, unique when set |
| `provider_payment_link_id` | text | Reserved for future Payment Links |
| `amount` | numeric | Order amount (INR, ≥ 0) |
| `currency` | text | Default `INR` |
| `status` | text | See status list |
| `webhook_received` | boolean | `true` once webhook confirmed |
| `webhook_event_id` | text | Unique nullable — idempotency key |
| `raw_payload` | jsonb | Raw webhook body |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

**Status values:** `created` · `pending` · `paid` · `failed` · `refunded` · `partially_refunded` · `cancelled`

**Module 11 uses:** `created` · `pending` · `paid` · `failed`

---

## RLS Policies (5)

| Policy | Operation | Who |
|---|---|---|
| Buyer reads own | SELECT | Buyer via `orders.buyer_id` join |
| Creator reads assigned | SELECT | Creator via `orders.creator_id` + `creator_profiles` join |
| Buyer can create payment | INSERT | Buyer, status in `created/pending`, provider = `razorpay` |
| Admin reads all | SELECT | `public.is_admin()` |
| Admin updates all | UPDATE | `public.is_admin()` |

> **Note:** Webhook updates (marking `paid`/`failed`) use the **service-role Supabase client** which bypasses RLS. No public UPDATE policy exists for payment status — users cannot mark their own payment as paid.

---

## Webhook Verification

The webhook route reads the raw request body as **text** before any JSON parsing.

Signature verification uses HMAC-SHA256:

```typescript
const expectedSignature = createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');
// Constant-time comparison to prevent timing attacks
```

- Invalid signature → `400 Bad Request`
- Valid but unprocessable → `200` (to prevent retries)
- Server error → `500` (Razorpay will retry)

---

## Idempotency

Duplicate webhooks are handled at multiple levels:

1. **`webhook_event_id`** — unique nullable column. Composed as `{event}:{provider_payment_id}`. If the same value already exists, the webhook is skipped.
2. **`provider_payment_id`** — unique index prevents duplicate payment records for the same Razorpay payment.
3. **Status check** — if `payment.status === 'paid'` on `payment.captured`, skip.
4. All duplicate webhooks return `200` to prevent Razorpay retries.

---

## Order / Payment Status Transitions

### On `payment.captured`

```
public.payments:  status → paid, webhook_received → true
public.orders:    payment_status → paid, order_status → paid
order_status_history: new_status = paid, changed_by = null, note = "Payment captured by Razorpay"
```

### On `payment.failed`

```
public.payments:  status → failed, webhook_received → true
public.orders:    payment_status → failed, order_status unchanged (payment_pending)
```

### Post-payment fulfillment (Module 10 creator actions)

After `order_status = paid`, creators can continue fulfillment:

```
paid → in_progress → shipped → delivered → completed
```

---

## Environment Variables

```env
# Required for Razorpay integration
RAZORPAY_KEY_ID=rzp_test_xxxxx        # Publishable — returned from server action
RAZORPAY_KEY_SECRET=xxxxx             # SECRET — never exposed to client
RAZORPAY_WEBHOOK_SECRET=xxxxx        # SECRET — never exposed to client

# Required for webhook admin client
SUPABASE_SERVICE_ROLE_KEY=xxxxx      # SECRET — webhook route only
```

---

## Security Rules

- `RAZORPAY_KEY_SECRET` is never returned to the client.
- `RAZORPAY_WEBHOOK_SECRET` is never returned to the client.
- `SUPABASE_SERVICE_ROLE_KEY` is only used in the server-side webhook route handler.
- `PayNowButton` client component only receives the return value from `createPaymentForOrderAction` — no secrets.
- The client Razorpay handler does **not** mark the payment as paid.
- No RLS policy allows authenticated users to set `payment_status = paid`.
- Amount always comes from the database row, never from the client.
- Buyer cannot pay for another user's order (enforced in service layer + RLS).
- Webhook amount is verified against expected paise before marking paid.

---

## Amounts

```typescript
// Always round to integer paise
const amountInPaise = Math.round(order.amount * 100);
// e.g. INR 999.99 → 99999 paise
```

---

## How to Apply Migration

```bash
# From project root
supabase db push
# This applies 009_payments.sql
```

---

## Testing Checklist

### Setup
1. `supabase db push` — apply migration 009
2. Set env vars in `apps/web/.env.local`:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ```
3. `pnpm dev`

### Create a payable order
4. Log in as a buyer with an active account
5. Create an order from a listing (via `/listings/[slug]`)
6. Verify: `order_status = payment_pending`, `payment_status = created`, `amount > 0`

### Pay Now flow
7. Open `/dashboard/buyer/orders/[id]`
8. Click **Pay Now** — Razorpay Checkout modal opens
9. Complete test payment (use Razorpay test card `4111 1111 1111 1111`)

### Webhook verification
10. Configure Razorpay webhook in Dashboard → Settings → Webhooks:
    - URL: `https://your-domain.com/api/webhooks/razorpay`
    - Events: `payment.captured`, `payment.failed`
    - Secret: same as `RAZORPAY_WEBHOOK_SECRET`
11. After test payment, webhook fires `payment.captured`
12. Verify `public.payments`: `status = paid`, `webhook_received = true`, `provider_payment_id` set
13. Verify `public.orders`: `payment_status = paid`, `order_status = paid`
14. Verify `public.order_status_history`: entry with `new_status = paid`, `changed_by = null`

### Failure path
15. Use Razorpay test failure card or simulate failed payment
16. Verify `public.payments.status = failed`
17. Verify `public.orders.payment_status = failed`, `order_status` unchanged

### Duplicate webhook
18. Send the same webhook event twice (use Razorpay Dashboard → resend)
19. Verify no duplicate `public.payments` rows
20. Webhook returns 200 both times

### Security
21. Send a webhook with an invalid signature → must receive `400`
22. Try updating `payment_status` directly via Supabase anon key → must fail (no RLS policy)
23. Inspect browser network tab → `RAZORPAY_KEY_SECRET` must NOT appear anywhere

### Creator fulfillment after payment
24. As creator, open `/dashboard/creator/orders/[id]` of the paid order
25. Click **Start Work** → order moves `paid → in_progress`
26. Continue: `in_progress → shipped → delivered`
27. As buyer, click **Mark Completed**

---

## What Is Intentionally NOT Implemented

- Refunds
- Wallet / escrow
- Automated seller payouts
- Settlement tracking
- Platform accounting
- Invoices
- Subscriptions
- Stripe / global payments (only INR/Razorpay)
- Admin payment dashboard
- Notifications on payment
- Razorpay Payment Links (not needed with Checkout approach)

---

## Next Module: Module 12 — Reviews

Module 12 will implement:
- Buyer-to-creator reviews after order completion
- Rating system
- Review display on creator profiles and listings
