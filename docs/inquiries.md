# Module 8: Inquiry System

Rosovia Module 8 implements the Inquiry System — a simple, one-reply contact mechanism that allows buyers to send inquiries to creators about listings or generally, and allows creators to reply once and manage inquiry status.

---

## Scope

| Area | Status |
|---|---|
| `public.inquiries` table | ✅ Migration 006 |
| RLS policies (7 policies) | ✅ Implemented |
| Core types (`Inquiry`, `InquiryWithDetails`, etc.) | ✅ `packages/core/src/types/inquiry.ts` |
| Zod validators (create, reply, status update, list params) | ✅ `packages/core/src/validators/inquiry.ts` |
| Repository layer | ✅ `packages/api/src/inquiries/inquiry.repository.ts` |
| Service layer | ✅ `packages/api/src/inquiries/inquiry.service.ts` |
| Buyer server actions | ✅ `apps/web/src/app/dashboard/buyer/inquiries/actions.ts` |
| Creator server actions | ✅ `apps/web/src/app/dashboard/creator/inquiries/actions.ts` |
| `InquiryForm` component | ✅ `apps/web/src/components/inquiry/inquiry-form.tsx` |
| `InquiryReplyForm` component | ✅ `apps/web/src/components/inquiry/inquiry-reply-form.tsx` |
| `InquiryStatusBadge` component | ✅ `apps/web/src/components/inquiry/inquiry-status-badge.tsx` |
| `InquiryCard` component | ✅ `apps/web/src/components/inquiry/inquiry-card.tsx` |
| `/creators/[slug]` — Send Inquiry CTA | ✅ Updated |
| `/listings/[slug]` — Send Inquiry CTA | ✅ Updated |
| `/dashboard/buyer/inquiries` page | ✅ Implemented |
| `/dashboard/creator/inquiries` page | ✅ Implemented |

---

## Database Table: `public.inquiries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `buyer_id` | uuid | FK → `profiles(id)` ON DELETE CASCADE |
| `creator_id` | uuid | FK → `creator_profiles(id)` ON DELETE CASCADE |
| `listing_id` | uuid | Nullable, FK → `listings(id)` ON DELETE SET NULL |
| `inquiry_type` | text | `general`, `product`, `service`, `mentorship`, `custom_order` |
| `message` | text | 1–2000 chars |
| `creator_response` | text | Nullable, ≤ 2000 chars |
| `status` | text | `open`, `replied`, `closed`, `spam` |
| `replied_at` | timestamptz | Set when creator first replies |
| `closed_at` | timestamptz | Set when either party closes |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-updated via trigger |
| `deleted_at` | timestamptz | Soft-delete |

---

## Inquiry Status Flow

```
[Buyer Creates]
      │
      ▼
   OPEN  ──── Creator marks spam ──► SPAM (terminal for creator view)
      │
      │  Creator replies (sets creator_response)
      ▼
  REPLIED
      │
      │  Buyer or creator closes
      ▼
  CLOSED (terminal)
```

| Status | Who Sets It | Meaning |
|---|---|---|
| `open` | System (on create) | New, awaiting reply |
| `replied` | Creator (after replying) | Creator has responded |
| `closed` | Buyer or creator | Resolved, no further action |
| `spam` | Creator | Hidden from active dashboard |

---

## RLS Policies

| Policy | Actor | Operation | Condition |
|---|---|---|---|
| Buyer can read own | Buyer | SELECT | `buyer_id` matches auth user, `deleted_at IS NULL` |
| Buyer can create own | Buyer | INSERT | `buyer_id` matches auth user, profile active, status=open, response fields null |
| Buyer can close own | Buyer | UPDATE | `buyer_id` matches, current status open/replied, new status=closed |
| Creator can read assigned | Creator | SELECT | `creator_id` matches auth creator, profile active, `deleted_at IS NULL` |
| Creator can update assigned | Creator | UPDATE | `creator_id` matches, new status in (replied, closed, spam) |
| Admin can read all | Admin | SELECT | `is_admin()` |
| Admin can update all | Admin | UPDATE | `is_admin()` |

> **Note:** Field-level immutability (`buyer_id`, `creator_id`, `listing_id`, `message`) after creation is enforced in the **service layer** (`inquiry.service.ts`), not RLS alone. Supabase/PostgreSQL RLS does not natively prevent individual column updates without complex triggers.

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
Service (packages/api/src/inquiries/inquiry.service.ts)
  │  auth check, business rules, field protection
  │  calls
  ▼
Repository (packages/api/src/inquiries/inquiry.repository.ts)
  │  executes Supabase query (RLS enforced)
  ▼
public.inquiries (PostgreSQL)
```

---

## Send Inquiry Flow

1. Buyer navigates to `/creators/[slug]` or `/listings/[slug]`
2. If **authenticated**: `InquiryForm` is rendered with `creatorId` (and optionally `listingId`) from server data
3. If **unauthenticated**: Sign-in CTA links to `/login?redirected_from=...`
4. Buyer selects inquiry type and writes message (10–2000 chars)
5. Submit → `createInquiryAction` → `createCurrentUserInquiry` service
6. Service validates: creator exists, creator active, listing approved (if provided), buyer ≠ creator
7. Row inserted with `status='open'`
8. Page revalidated; buyer redirected to view their inquiry in `/dashboard/buyer/inquiries`

---

## Buyer Dashboard Flow

Route: `/dashboard/buyer/inquiries`

- Requires authenticated user, `profile.status = 'active'`
- Any role (buyer/creator/admin) can view their own sent inquiries
- Lists all non-deleted inquiries sent by the current user
- Shows: creator name, listing title (if any), inquiry type, status badge, message, creator response
- Action: "Close inquiry" button for `open` / `replied` inquiries

---

## Creator Dashboard Flow

Route: `/dashboard/creator/inquiries`

- Requires `profile.role = 'creator'`, `profile.status = 'active'`, creator profile must exist
- Lists all non-deleted inquiries assigned to the creator profile
- Shows: buyer name, listing title (if any), inquiry type, status badge, message, reply form
- Actions:
  - **Reply**: `InquiryReplyForm` if status is `open` and no response yet
  - **Close**: sets status → `closed`
  - **Mark spam**: sets status → `spam`

---

## Security Rules

- `buyer_id` is always resolved server-side from the authenticated session — client cannot supply it
- `creatorId` and `listingId` on public pages come from server-fetched page data — client cannot override them
- Creator cannot change `buyer_id`, `creator_id`, `listing_id`, or original `message` — enforced in service
- Buyer can only set `status = 'closed'` — enforced in service
- Creator can only set `status ∈ (replied, closed, spam)` — enforced in RLS and service
- No service-role key is used in any public action

---

## Intentionally NOT Implemented (Module 8)

- Real-time chat or message threading
- Multiple replies per inquiry
- Email or push notifications
- Custom order workflow (Module 9)
- Orders and payments (Modules 10–11)
- Reviews and ratings (Module 12)
- Verification workflow (Module 13)
- Admin inquiry management UI (Module 14/15)
- Redis, queues, Prisma, Drizzle

---

## Next Module

**Module 9: Custom Orders** — Allow buyers to request custom work from creators, with scoped deliverables, pricing, and acceptance flow.
