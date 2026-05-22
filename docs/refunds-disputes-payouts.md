# Refunds, Disputes, and Payouts — Rosovia

## Overview

The `refund_requests`, `disputes`, and `creator_payouts` tables and their associated service layer are fully implemented. The dashboard pages for buyers, creators, and admins are all live.

> ⚠️ **Important**: All money movement (actual refund transfers, creator bank payouts) is currently **manual admin-only**. No Razorpay Refund API or RazorpayX bank transfer integration is active. This is explicitly planned as future work.

---

## Database Tables

### `public.refund_requests`

Tracks buyer-initiated refund requests against paid orders.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `order_id` | FK → `orders.id` |
| `payment_id` | FK → `payments.id` |
| `buyer_id` | FK → `profiles.id` |
| `amount` | Requested refund amount |
| `currency` | Default `INR` |
| `reason` | `duplicate_payment` / `wrong_item` / `not_delivered` / `poor_quality` / `creator_cancelled` / `buyer_cancelled` / `fraud_suspected` / `other` |
| `description` | Optional text, max 2000 chars |
| `status` | `requested` / `approved` / `rejected` / `processed` / `failed` / `cancelled` |
| `admin_note` | Optional admin review note |
| `reviewed_by` | FK → `profiles.id` (admin who reviewed) |
| `reviewed_at` | When admin reviewed |
| `processed_at` | When refund was marked processed |
| `created_at`, `updated_at`, `deleted_at` | Standard timestamps |

### `public.disputes`

Tracks formal disputes raised by buyers or creators against orders.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `order_id` | FK → `orders.id` |
| `opened_by` | FK → `profiles.id` (buyer or creator who raised) |
| `reason` | `payment_issue` / `not_delivered` / `late_delivery` / `quality_issue` / `wrong_item` / `miscommunication` / `fraud_suspected` / `abusive_behavior` / `other` |
| `description` | Optional text, max 3000 chars |
| `status` | `open` / `under_review` / `resolved` / `rejected` / `cancelled` |
| `resolution_note` | Admin's resolution explanation |
| `resolved_by` | FK → `profiles.id` (admin who resolved) |
| `resolved_at` | When resolved |
| `created_at`, `updated_at`, `deleted_at` | Standard timestamps |

### `public.creator_payouts`

Tracks pending and completed earnings settlements for creators.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `creator_id` | FK → `creator_profiles.id` |
| `order_id` | FK → `orders.id` |
| `payment_id` | FK → `payments.id`, nullable |
| `amount` | Payout amount |
| `currency` | Default `INR` |
| `status` | `pending` / `processing` / `paid` / `failed` / `on_hold` / `cancelled` |
| `provider` | `manual` / `razorpayx` / `bank_transfer` |
| `provider_reference` | External transfer reference, nullable |
| `scheduled_at` | Planned payout date, nullable |
| `processing_started_at` | When processing began, nullable |
| `paid_at` | When transfer completed, nullable |
| `failure_reason` | Failure details, nullable |
| `admin_note` | Admin note, nullable |
| `created_at`, `updated_at`, `deleted_at` | Standard timestamps |

---

## RLS Policies

### refund_requests

| Policy | Who | Operation |
|---|---|---|
| Buyer reads own | `buyer_id` → current profile | SELECT |
| Creator reads related | Creator of the order | SELECT |
| Buyer creates request | Active buyer, order belongs to buyer | INSERT |
| Admin reads all | `is_admin()` | SELECT |
| Admin updates all | `is_admin()` | UPDATE |

### disputes

| Policy | Who | Operation |
|---|---|---|
| Buyer reads own | `opened_by` → current profile OR buyer of order | SELECT |
| Creator reads related | Creator of disputed order | SELECT |
| User creates dispute | Buyer or creator of the order | INSERT |
| Admin reads all | `is_admin()` | SELECT |
| Admin updates all | `is_admin()` | UPDATE |

### creator_payouts

| Policy | Who | Operation |
|---|---|---|
| Creator reads own | `creator_id` → current creator profile | SELECT |
| Admin reads all | `is_admin()` | SELECT |
| Admin updates all | `is_admin()` | UPDATE |

---

## TypeScript Service Layer

### Refund Service (`packages/api/src/refunds/`)

| Function | Who Can Call | What It Does |
|---|---|---|
| `createCurrentBuyerRefundRequest` | Buyer | Creates a refund request via atomic RPC, validates order ownership |
| `listBuyerRefundRequests` | Buyer | Lists own refund requests with pagination |
| `listAdminRefundRequests` | Admin | Lists all refund requests with filters |
| `moderateRefundRequest` | Admin | Approve / reject / process / fail / cancel a request + logs to `admin_actions` |

> **Security**: Buyers cannot approve their own refund requests. The `moderateRefundRequest` function requires an active admin context.

### Dispute Service (`packages/api/src/disputes/`)

| Function | Who Can Call | What It Does |
|---|---|---|
| `createDisputeForOrder` | Buyer / Creator | Opens a dispute via atomic RPC |
| `listCreatorDisputes` | Creator | Lists disputes related to their orders |
| `listAdminDisputes` | Admin | Lists all disputes with filters |
| `moderateDispute` | Admin | Mark under_review / resolve / reject + logs to `admin_actions` |

> **Security**: Creators cannot resolve disputes they opened. The `moderateDispute` function requires an active admin context.

### Payout Service (`packages/api/src/payouts/`)

| Function | Who Can Call | What It Does |
|---|---|---|
| `listCreatorPayouts` | Creator | Lists own payouts (strictly filtered by `creator_profile_id`) |
| `listAdminPayouts` | Admin | Lists all payouts with filters |
| `moderatePayout` | Admin | processing / pay / fail / hold / cancel a payout + logs to `admin_actions` |

> **Security**: Creators can only see their own payouts. The creator profile ID is resolved from the authenticated session — it is never accepted from the client.

---

## Frontend Dashboard Pages

| Page | Route | Who |
|---|---|---|
| Buyer Refunds | `/dashboard/buyer/refunds` | Buyer — see all refund requests, status tracking |
| Admin Disputes | `/dashboard/admin/disputes` | Admin — review and moderate all disputes |
| Creator Payouts | `/dashboard/creator/payouts` | Creator — see earnings stats and payout history |

---

## Admin Audit Log

All admin moderation actions on refunds, disputes, and payouts are recorded in the immutable `admin_actions` table with action types:

- Refunds: `refund_approved`, `refund_rejected`, `refund_processed`, `refund_failed`, `refund_cancelled`
- Disputes: `dispute_under_review`, `dispute_resolved`, `dispute_rejected`
- Payouts: `payout_processing`, `payout_paid`, `payout_failed`, `payout_on_hold`

---

## Current Limitations & Future Work

| Feature | Current State | Future Plan |
|---|---|---|
| Refund money movement | Manual admin only | Integrate Razorpay Refund API (`POST /v1/payments/{id}/refund`) |
| Creator payout transfer | Manual admin only | Integrate RazorpayX or bank transfer API |
| Payout schedule | No automated schedule | Scheduled weekly/monthly batch payout job |
| Dispute evidence upload | No file attachment | Add media upload support to dispute form |
| Escrow | Not implemented | Hold payment in escrow until delivery confirmed |
| Platform fee settlement | `platform_fee` always 0 | Define and collect platform fee before payout |
