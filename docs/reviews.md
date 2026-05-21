# Module 12: Reviews

Rosovia Module 12 adds a buyer review system so that buyers can rate creators after a completed, paid order. Reviews build marketplace trust and update creator rating summaries automatically.

---

## Scope

Module 12 implements:

- `public.reviews` database table
- One-review-per-order enforcement
- Review eligibility rules (completed + paid order only)
- Creator rating aggregation via DB trigger
- Zod validation schemas
- Repository and service layer
- Server actions
- UI components: `ReviewForm`, `ReviewCard`, `RatingInput`, `RatingDisplay`, `ReviewList`
- Buyer review creation on `/dashboard/buyer/orders/[id]`
- Buyer reviews dashboard at `/dashboard/buyer/reviews`
- Creator reviews dashboard at `/dashboard/creator/reviews`
- Public reviews on `/creators/[slug]`
- Public reviews on `/listings/[slug]`
- Admin hide-review support at the service/data layer (no UI in Module 12)

---

## Reviews Table Summary

**Table:** `public.reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK → orders(id), unique (one review per order) |
| `buyer_id` | uuid | FK → profiles(id) |
| `creator_id` | uuid | FK → creator_profiles(id) |
| `listing_id` | uuid | FK → listings(id), nullable |
| `rating` | integer | 1–5, required |
| `quality_rating` | integer | 1–5, optional |
| `communication_rating` | integer | 1–5, optional |
| `delivery_rating` | integer | 1–5, optional |
| `comment` | text | Optional, max 2000 chars |
| `media_id` | uuid | FK → media_assets(id), nullable (future use) |
| `is_hidden` | boolean | Default false; admin can set true |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete, nullable |

---

## One-Review-Per-Order Rule

A unique index on `order_id` prevents duplicate reviews at the database level:

```sql
create unique index if not exists reviews_order_id_unique_idx
  on public.reviews(order_id);
```

The service layer (`createCurrentBuyerReview`) additionally checks for an existing review before inserting, returning a descriptive error to the client.

---

## Review Eligibility Rules

A buyer can submit a review only when **all** of the following are true:

1. User is authenticated.
2. User's `profiles.status = 'active'`.
3. The order (`order_id`) belongs to the authenticated buyer.
4. `order.order_status = 'completed'`.
5. `order.payment_status = 'paid'`.
6. `order.deleted_at IS NULL`.
7. No review already exists for that order (`getReviewByOrderId` returns null).
8. The creator profile still exists (not deleted).
9. The buyer is **not** the owner of the target creator profile (self-review prevention).

The service layer (`review.service.ts`) is the **primary enforcement point** for eligibility rules 3–9. The RLS INSERT policy enforces buyer identity and profile activity, but cannot efficiently join to `orders` to check `order_status` and `payment_status` without risk of recursion. This limitation is documented and consistent with the approach used in Orders and Payments modules.

---

## Rating Aggregation Behavior

After any INSERT, UPDATE, or DELETE on `public.reviews`, a PostgreSQL trigger automatically recalculates `creator_profiles.rating_avg` and `creator_profiles.rating_count`:

- **Function:** `public.recalculate_creator_rating(target_creator_id uuid)`
- **Trigger:** `recalculate_creator_rating_trigger` (AFTER INSERT OR UPDATE OR DELETE, FOR EACH ROW)
- **Calculation:** `AVG(rating)` and `COUNT(*)` from rows where `is_hidden = false AND deleted_at IS NULL`
- **If no visible reviews:** `rating_avg = 0`, `rating_count = 0`
- **Security:** Function uses `security definer` to UPDATE `creator_profiles` reliably, regardless of the calling user's RLS permissions

This means:
- Rating updates happen immediately on review insert.
- If an admin hides a review (`is_hidden = true`), the trigger fires and removes it from the average.
- No manual rating recalculation is needed from the application layer.

---

## RLS Policies

| # | Policy | Operation | Who |
|---|---|---|---|
| 1 | Public can read visible reviews | SELECT | anon + authenticated (`is_hidden=false AND deleted_at IS NULL`) |
| 2 | Buyer can read own reviews | SELECT | authenticated (buyer_id matches) |
| 3 | Creator can read received reviews | SELECT | authenticated (creator_id matches, active creator) |
| 4 | Buyer can create review | INSERT | authenticated (buyer_id matches, is_hidden must be false) |
| 5 | Admin can read all reviews | SELECT | authenticated (`is_admin()`) |
| 6 | Admin can update reviews | UPDATE | authenticated (`is_admin()`) |

> **Note:** Buyer UPDATE policy is omitted in Module 12. Reviews are create-once in the MVP. Editing can be added in a future module.

---

## Service / Repository Flow

```
Client ReviewForm (client component)
  → createReviewAction() [apps/web/src/app/actions/reviews.ts]
    → reviewCreateSchema.safeParse()         [validation]
    → createCurrentBuyerReview()             [packages/api/src/reviews/review.service.ts]
      → resolveActiveProfile()               [auth + profile check]
      → supabase: fetch order               [ownership + eligibility]
      → getReviewByOrderId()                 [duplicate check]
      → self-review prevention check
      → createReview()                       [packages/api/src/reviews/review.repository.ts]
        → supabase.from('reviews').insert()
          → DB trigger fires automatically  [recalculate_creator_rating]
    → revalidatePath()                       [Next.js cache invalidation]
```

---

## Buyer Review Flow

1. Buyer navigates to `/dashboard/buyer/orders/[id]`.
2. If `order_status = completed` AND `payment_status = paid` AND no existing review:
   - `ReviewForm` is shown below the Payment Status card.
3. Buyer selects an overall rating (required) and optionally fills sub-ratings and a comment.
4. On submit: `createReviewAction` → service → DB insert → trigger recalculates creator rating.
5. Page refreshes. The submitted review is now shown as a read-only `ReviewCard`.
6. If the order is not eligible, an informational message is shown instead.

---

## Creator Reviews Dashboard Flow

1. Creator navigates to `/dashboard/creator/reviews`.
2. Auth guard: must be authenticated, active, role=creator, and have a creator profile.
3. The page fetches all reviews received (including hidden ones for creator visibility).
4. The creator's live `rating_avg` and `rating_count` from `creator_profiles` are shown.
5. Hidden reviews display an orange "Hidden from public" badge.

---

## Public Review Display Flow

### `/creators/[slug]`
- Fetches visible reviews via `listReviewsForPublicCreator(supabase, profile.id)`.
- Renders `ReviewList` below the Skills/Languages sections.
- Rating count shown in the section header.
- `RatingSummary` component (from Module 4) continues to display in the profile header.

### `/listings/[slug]`
- Fetches visible reviews via `listReviewsForPublicListing(supabase, listing.id)`.
- Renders `ReviewList` at the bottom of the page, below the Inquiry form.
- Only reviews where `listing_id = listing.id` are shown.

**Visibility filter applied in both cases:**
- `is_hidden = false`
- `deleted_at IS NULL`

---

## Admin Hide Support (Future Moderation Foundation)

An admin can hide a review by calling `hideReviewAsAdmin(supabase, { reviewId, isHidden, note })` via the `hideReviewAction` server action.

- When `is_hidden` is set to `true`, the DB trigger fires and removes the review from the creator's rating average.
- Hidden reviews no longer appear on public pages.
- The creator dashboard shows a hidden badge on hidden reviews.
- **No admin UI is built in Module 12.** The admin moderation dashboard and full moderation workflow come in a later module.

---

## Intentionally Not Implemented in Module 12

- Full admin moderation dashboard
- Review replies
- Review editing (MVP is create-once)
- Review helpful votes
- Review media upload UI (field is in DB for future use)
- Abusive content reporting workflow
- Notifications
- Pagination UI (data layer supports `page` param but no pagination UI)

---

## Next Module: Module 13 — Verification

Module 13 will implement the creator verification workflow, allowing Rosovia to verify creator identity and upgrade `verification_level` on `creator_profiles`. This includes:
- Verification document submission
- Admin verification review
- Verification badge progression
- Verified badge display updates on public profiles
