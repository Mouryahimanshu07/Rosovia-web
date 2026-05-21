# Module 13: Verification

Rosovia Module 13 implements the Creator Verification workflow. Creators can submit identity or business documents for verification. Rosovia admins review and approve or reject requests. Approved requests update the creator's verification level and badge on their public profile.

---

## Scope

Module 13 implements:

- `public.verification_requests` database table
- One-pending-per-type enforcement (partial unique index)
- RLS policies for creator submit and admin review
- Zod validation schemas
- Repository and service layer
- Creator verification dashboard (`/dashboard/creator/verification`)
- Admin verification review page (`/dashboard/admin/verification`)
- Server actions: `createVerificationRequestAction`, `reviewVerificationRequestAction`
- UI components: `VerificationLevelBadge`, `VerificationStatusCard`, `VerificationRequestForm`, `VerificationRequestCard`, `VerificationReviewActions`
- Creator profile dashboard update (verification status + "Request Verification" link)
- `VerificationBadge` placeholder title removed (now shows real status)
- `VerificationLevelBadge` new component with improved aria labels
- Documentation update

---

## Verification Requests Table Summary

**Table:** `public.verification_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → profiles(id) |
| `creator_id` | uuid | FK → creator_profiles(id), nullable |
| `verification_type` | text | creator / seller / mentor / business |
| `requested_level` | text | basic_verified / creator_verified / seller_verified |
| `document_type` | text | identity / business / portfolio / address / certificate / other |
| `document_media_id` | uuid | FK → media_assets(id), ON DELETE RESTRICT |
| `status` | text | pending / approved / rejected |
| `admin_note` | text | Optional, max 2000 chars |
| `reviewed_by` | uuid | FK → profiles(id), nullable |
| `reviewed_at` | timestamptz | Nullable |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete, nullable |

---

## Verification Levels

| Level | Public Requestable | Description |
|---|---|---|
| `none` | — | No verification |
| `basic_verified` | ✅ | Basic identity confirmed |
| `creator_verified` | ✅ | Stronger creator profile verification |
| `seller_verified` | ✅ | Authorized to sell products/services |
| `trusted_seller` | ❌ Admin-only | Reserved for future admin-only grants |

---

## One-Pending-Per-Type Rule

A partial unique index prevents more than one active pending request per user per verification type:

```sql
create unique index if not exists verification_requests_one_pending_per_type_idx
  on public.verification_requests(user_id, verification_type)
  where status = 'pending' and deleted_at is null;
```

The service layer also explicitly checks `getPendingVerificationRequestByUserAndType` before inserting.

---

## Verification Status Flow

```
Creator submits request → status: pending
  ↓
Admin approves
  → status: approved
  → creator_profiles.is_verified = true
  → creator_profiles.verification_level = requested_level
  → Badge appears on public creator profile

Admin rejects
  → status: rejected
  → admin_note stored (reason shown to creator)
  → creator_profiles NOT updated
  → Creator can resubmit after rejection
```

---

## Private Document Handling

- Verification documents must use `media_assets.is_private = true`.
- Documents are uploaded via the existing `MediaUpload` component with `usage="verification_document"` and `isPrivate={true}`.
- Documents are stored in Cloudflare R2 as private objects with no public URL.
- The admin review UI shows **document metadata only** (filename from storage_key, MIME type, size, upload date).
- No download link is generated in Module 13 — this requires a secure signed-download flow which is documented as future work.
- `document_media_id` uses `ON DELETE RESTRICT` to prevent accidental deletion of documents referenced by requests.

### Media Validation (Service Layer)

The service enforces the following before creating a request:

| Check | Enforced In |
|---|---|
| Media belongs to current user (`owner_id = profile.id`) | Service |
| `is_private = true` | Service |
| `media_type in ('document', 'image')` | Service |
| `status in ('uploaded', 'ready')` | Service |

RLS INSERT cannot fully enforce these checks without joins that risk recursion. Service-layer enforcement is consistent with the approach used in reviews, orders, and payments modules.

---

## RLS Policies

| # | Policy | Operation | Who |
|---|---|---|---|
| 1 | User can read own requests | SELECT | authenticated (user_id matches) |
| 2 | Creator can insert own request | INSERT | authenticated (role=creator, active, is_pending, no reviewed fields, not trusted_seller) |
| 3 | No user UPDATE | — | Not created in Module 13 |
| 4 | Admin can read all | SELECT | authenticated (`is_admin()`) |
| 5 | Admin can update | UPDATE | authenticated (`is_admin()`) |

**Note:** No public SELECT policy exists. Verification requests are private.

---

## Service / Repository Flow

```
Client VerificationRequestForm (client component)
  → createVerificationRequestAction()  [apps/web/src/app/dashboard/creator/verification/actions.ts]
    → verificationRequestCreateSchema.safeParse()         [validation]
    → createCurrentCreatorVerificationRequest()            [packages/api/src/verification/verification.service.ts]
      → resolveActiveProfile()                             [auth + active check]
      → profile.role === 'creator'                        [role check]
      → getCreatorProfileByUserId()                        [creator profile exists]
      → requestedLevel !== 'trusted_seller'               [level guard]
      → getPendingVerificationRequestByUserAndType()       [duplicate check]
      → getMediaAssetForVerification()                     [media validation]
      → createVerificationRequest()                        [repository insert]
    → revalidatePath('/dashboard/creator/verification')

Admin VerificationReviewActions (client component)
  → reviewVerificationRequestAction()  [apps/web/src/app/dashboard/admin/verification/actions.ts]
    → verificationReviewSchema.safeParse()
    → reviewVerificationRequestAsAdmin()                   [packages/api/src/verification/verification.service.ts]
      → resolveActiveProfile()                             [auth + active check]
      → profile.role === 'admin'                           [admin check]
      → getVerificationRequestById()                       [request exists + pending]
      → request.user_id !== profile.id                     [cannot self-review]
      → on approve:
        → updateVerificationRequest(status: approved)
        → updateCreatorVerificationStatus(level, isVerified: true)
      → on reject:
        → updateVerificationRequest(status: rejected)
        → creator_profiles NOT updated
    → revalidatePath('/dashboard/admin/verification')
    → revalidatePath('/creators', 'layout')
```

---

## Creator Request Flow

1. Creator navigates to `/dashboard/creator/verification`.
2. If no creator profile → redirected to create one.
3. Current verification status is shown.
4. If no pending request for a type → form is available.
5. Creator selects verification type, requested level, document type.
6. Creator uploads a **private** document via MediaUpload (`usage="verification_document"`, `isPrivate=true`).
7. On submit: `createVerificationRequestAction` → service → DB insert.
8. Page shows "Pending review" status.
9. Creator cannot submit another request for the same type while pending.

---

## Admin Approve / Reject Flow

1. Admin navigates to `/dashboard/admin/verification`.
2. Pending requests are listed with document metadata (no download link).
3. Admin provides optional admin note and clicks Approve or Reject.
4. On Approve:
   - `verification_requests.status = approved`
   - `creator_profiles.is_verified = true`
   - `creator_profiles.verification_level = requested_level`
5. On Reject:
   - `verification_requests.status = rejected`
   - `admin_note` stores rejection reason
   - creator profile NOT updated
6. Creator sees the rejection reason on their verification dashboard.

---

## Public Badge Display Rules

- `/creators/[slug]` shows the `VerificationBadge` based on `creator_profiles.verification_level`.
- `VerificationBadge` title is now accurate ("Verification status: Creator Verified") — placeholder removed.
- New `VerificationLevelBadge` component used in dashboard with improved aria labels.
- No verification request history is shown publicly.
- No documents or admin notes are exposed publicly.

---

## Security Rules

1. Verification requests are private — no public SELECT policy.
2. Buyers cannot submit verification requests (role check).
3. Creators cannot approve their own requests (service-level guard).
4. Private documents have no public URL and are never returned in API responses.
5. Admin approval updates creator profile — no trust that client submits level directly.
6. `trusted_seller` cannot be requested publicly — enforced at DB constraint + service + validator.
7. Admin must be authenticated with `role = admin` and `status = active`.
8. `document_media_id` uses `ON DELETE RESTRICT` to prevent orphaned requests.

---

## What Is Intentionally Not Implemented in Module 13

- Full admin dashboard system
- Reports / moderation workflow
- Creator cancellation of pending requests
- Request editing / resubmission UI (resubmit by creating a new request after rejection)
- Secure signed document download URLs (documented as future work)
- KYC vendor integration (Aadhaar / PAN / OCR / face matching)
- Automated / AI verification
- Email / notification on status change
- Pagination UI (data layer supports `page` param)
- trusted_seller public request (admin-only)
- Payment / payout verification

---

## How to Apply Migration

```bash
# From packages/database/
supabase db push
```

Or apply manually via Supabase Studio → SQL Editor → paste `011_verification_requests.sql`.

---

## Next Module

**Module 14: Reports / Moderation** or **Admin Dashboard** — depending on roadmap.

Suggested scope:
- `public.reports` table for user-submitted content reports
- Admin moderation queue
- Creator suspension / review workflow
