# Security Architecture — Rosovia

This document describes the security model, hardening measures, and invariants that Rosovia enforces at every layer of the stack.

---

## Layered Security Model

Rosovia enforces security at four independent layers:

```
1. Zod Validation          — inputs validated before reaching service layer
2. Service-layer Guards    — business rule checks (role, ownership, status)
3. Row Level Security      — PostgreSQL RLS policies enforce data access at the DB
4. Secret Management       — secrets never exposed to client bundles
```

Each layer is a fail-safe. A bug in one layer does not compromise the others.

---

## Authentication & Session

- Supabase Auth manages sessions using JWT (HTTP-only cookies via the `@supabase/ssr` package).
- All server-rendered pages and server actions call `supabase.auth.getUser()` to verify the session — **not** `getSession()`, which relies on the unverified JWT payload.
- Unauthenticated access to protected dashboard routes is blocked by the Next.js middleware (`apps/web/src/middleware.ts`) before any page code runs.
- Middleware checks both session existence and profile `status = active`. Suspended accounts are redirected to `/login?error=account_suspended`.

### Role-based Access

- `profiles.role` values: `buyer`, `creator`, `admin`
- Role is set at signup via the `select-role` step and enforced server-side.
- Dashboard routes gate on role: a buyer visiting `/dashboard/creator` is redirected server-side.
- Role escalation to `admin` is blocked by RLS: the `profiles` UPDATE policy explicitly prevents users from setting their own role to `admin`.

---

## Row Level Security (RLS)

RLS is enabled on **all** public tables. See the per-table migration files for exact policies.

### Key RLS helpers

```sql
-- Defined in 015_security_hardening.sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;
```

`is_admin()` is used as the guard for all admin SELECT/UPDATE/INSERT policies.

### Service Role Client

The Supabase service-role client bypasses RLS entirely. It is **only instantiated** in:
- `apps/web/src/app/api/webhooks/razorpay/route.ts` (payment webhook handler)
- Admin server actions that require elevated trust (e.g., atomic moderation RPCs)
- Admin-facing API routes for private media signed URLs

The service-role client is never created in browser-executed code.

---

## Security-Definer RPCs (Atomic Operations)

Critical state transitions are wrapped in `SECURITY DEFINER` PostgreSQL functions to guarantee atomicity and prevent partial updates that could leave the system in an inconsistent state.

Key RPCs (defined in migrations 016, 021, 023):

| RPC | Purpose |
|---|---|
| `process_razorpay_payment_capture` | Atomically update `payments` + `orders` + insert `order_status_history` on payment capture |
| `create_refund_request_atomic` | Validates order ownership + payment status + inserts `refund_requests` atomically |
| `create_dispute_atomic` | Validates order context + inserts `disputes` |
| `create_creator_payout_for_order` | Validates order completion + inserts `creator_payouts` |
| `admin_suspend_user_atomic` | Suspends user + logs `admin_actions` in one transaction |
| `admin_approve_listing_atomic` | Approves listing + logs audit action atomically |

These RPCs are called with the anon key (via authenticated RLS context); the `SECURITY DEFINER` attribute allows them to perform privileged writes (such as updating tables across policies) in a controlled, auditable way.

---

## Payment Security

- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are never sent to the client.
- Webhook signature is verified using HMAC-SHA256 on the raw request body **before** any JSON parsing.
- Invalid signatures return `400 Bad Request`.
- `payment_status = paid` can only be set by the webhook handler (service-role client). No RLS policy allows a normal user to set this value.
- The Razorpay amount in the webhook is verified against the expected amount (in paise) from the database before marking a payment as paid. Mismatched amounts are rejected.
- Idempotency: duplicate webhooks are detected by `webhook_event_id` unique constraint and silently skipped.

---

## Media Security

- Private media (verification documents, private uploads) is stored under `private/` prefix in R2.
- The `public_url` column in `media_assets` is **always `null`** for private media — it is never set by the server for private paths.
- Migration `022_media_protected_columns.sql` adds protected columns (`is_private`, `storage_key`) that cannot be modified by authenticated users via the anon key.
- Admin-only signed read URLs for private media are issued by `/api/admin/media/[id]/signed-read-url` (server-side only, admin session required).
- Public media is only readable after `status = 'ready'` and `is_private = false`.

---

## Admin Action Audit Log

All admin moderation decisions are recorded in the immutable `admin_actions` table:

- No UPDATE or DELETE policy exists for `admin_actions` — it is append-only.
- Every moderation action (suspend user, approve listing, resolve dispute, etc.) logs: `admin_id`, `action_type`, `target_type`, `target_id`, `note`, and `created_at`.
- The audit log is accessible only to admins via the admin dashboard (`/dashboard/admin/audit-logs`).

---

## Secret Management Rules

| Secret | Where Used | Never In |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook handler, admin API routes | Client code, `NEXT_PUBLIC_` prefix |
| `RAZORPAY_KEY_SECRET` | Razorpay Orders API call (server action) | Client code, response body |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification | Client code, logs, Sentry payloads |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Presigned URL generation (server routes) | Client code |
| `SENTRY_AUTH_TOKEN` | Source map upload (CI/CD only) | `.env.local`, git, any app code |
| `DATABASE_URL` | Migration tooling only | Runtime app code |

### Sentry scrubbing

The Sentry `beforeSend` hook (`sentry.client.config.ts`, `sentry.server.config.ts`) removes the `raw_payload` field from Razorpay webhook events before sending to Sentry. This prevents accidental payment data leakage in error reports.

---

## Input Validation

All user-supplied inputs pass through **Zod schemas** before reaching service or repository layers:

- Server actions validate inputs using `packages/core/src/validators/`.
- Invalid inputs throw structured validation errors that are surfaced to the UI without exposing internal details.
- No raw SQL with interpolated user strings. All database queries use Supabase's parameterized query builder.

---

## Content Visibility Guards

- **Listings**: Only exposed if `status = 'approved'` AND `deleted_at IS NULL` AND creator `status = 'active'`.
- **Creator profiles**: Only exposed if `deleted_at IS NULL` AND base profile `status = 'active'`.
- **Categories**: Only exposed if `is_active = true`.
- **Verification documents**: Never exposed in public URLs. Admin access requires a server-side signed read URL.
- **Refund/dispute details**: Buyers see only their own; creators see only disputes related to their orders; admins see all.

---

## Known Limitations & Future Hardening

- **Automated content moderation**: No AI/ML-based content scanning. Currently relies on manual admin review and user reports.
- **Rate limiting**: No request rate limiting on API routes at the application layer. Relies on Vercel edge network and Supabase connection limits.
- **MFA**: Supabase Auth supports MFA (TOTP) but it is not currently enforced for admin accounts.
- **CSRF**: Next.js App Router server actions are CSRF-protected by design (same-origin enforcement), but an explicit CSRF token mechanism is not implemented for custom API routes.
- **Legal / compliance**: Privacy policy, cookie notice, and GDPR/IT Act compliance documentation are not yet in place.
