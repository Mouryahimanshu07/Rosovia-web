# Listings — Rosovia Module 5

## Scope

Module 5 implements the Listings foundation. Listings are the marketplace objects through which creators offer their products, services, mentorship sessions, workshops, event bookings, and portfolio items to buyers.

**In scope:**
- `listings` database table, migration, and RLS
- Listing Zod validators (form-layer and service-layer, separated)
- Service/repository functions in `@rosovia/api`
- Server actions in `apps/web/src/app/dashboard/creator/listings/actions.ts`
- Creator dashboard listing list (`/dashboard/creator/listings`)
- Create listing page (`/dashboard/creator/listings/new`)
- Edit listing page (`/dashboard/creator/listings/[id]/edit`)
- Public listings page (`/listings`)
- Public listing detail page (`/listings/[slug]`)
- Listing card component
- Listing status badge component
- Listing type badge component
- Listing metadata view component
- Listing form component (React Hook Form + Zod)
- Inline actions (submit for review, archive, restore to draft)
- Slug generation with numeric counter collision handling
- Metadata as `jsonb` (no separate tables)

**Out of scope (Module 6+):**
- Media upload system (Cloudflare R2) — Module 6
- Listing cover images/media — Module 6
- Inquiry system — Module 8
- Custom order requests — Module 9
- Orders and checkout — Module 10
- Payments (Razorpay) — Module 11
- Reviews — Module 12
- Verification workflow — Module 13
- Admin listing approval UI — Module 15

---

## Database: `public.listings`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `creator_id` | uuid FK | → `creator_profiles.id`, CASCADE delete |
| `category_id` | uuid FK | → `categories.id` |
| `listing_type` | text | product, service, mentorship, workshop, event_booking, portfolio |
| `title` | text | Required |
| `slug` | text | Unique |
| `description` | text | Optional |
| `price` | numeric | Optional, ≥ 0 |
| `currency` | text | Default `INR` |
| `stock` | integer | Optional, ≥ 0 |
| `city` | text | Optional |
| `state` | text | Optional |
| `custom_order_available` | boolean | Default false |
| `delivery_available` | boolean | Default false |
| `online_available` | boolean | Default false |
| `offline_available` | boolean | Default false |
| `status` | text | draft / pending_review / approved / rejected / archived / suspended |
| `verification_status` | text | unverified / pending / verified / rejected |
| `metadata` | jsonb | Flexible category-specific fields |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

---

## Listing Status Flow (Module 5)

```
[draft]
  ↓  (creator submits)
[pending_review]
  ↓  (admin approves — manually in DB for now)
[approved]  ← visible to public
  ↓  (creator archives OR listing removed)
[archived]  ← not public
  ↑  (creator restores)
[draft]

[rejected]  ← creator can see, not public; can restore to draft
[suspended] ← admin only; cannot archive/restore
```

**Creator-allowed transitions:**
- `draft` → `pending_review` (submit for review)
- `draft/pending_review/approved/rejected` → `archived`
- `archived/rejected` → `draft`

**System/admin-only transitions:**
- `pending_review` → `approved`
- `pending_review` → `rejected`
- any → `suspended`

---

## RLS Summary

| Policy | Who | Type | Condition |
|---|---|---|---|
| `public can read approved` | Any | SELECT | `status = approved` AND `deleted_at IS NULL` |
| `creator can read own` | Authenticated | SELECT | Owns listing via creator_profile chain |
| `creator can insert own` | Authenticated | INSERT | Owns creator_profile, role=creator, active, status=draft |
| `creator can update own` | Authenticated | UPDATE | Same ownership, status can only be draft/pending_review/archived |
| `admin can read all` | Admin | SELECT | `is_admin()` |
| `admin can update all` | Admin | UPDATE | `is_admin()` |

> **Column-level protection for `status` approved/rejected/suspended and `verification_status` verified** is enforced both in RLS (WITH CHECK constraints) and the service layer (service functions map specific allowed transitions only).

---

## Service / Repository Flow

```
Client ListingForm
  → zodResolver(listingFormSchema)              [form validation, browser]
  → onSubmit() parses price/stock strings       [form → action input]
  → createListingAction(input) [server action]
      → listingCreateSchema.safeParse(input)    [re-validate on server]
      → createCurrentCreatorListing(supabase, input)
          → resolveCreatorProfile()             [verify auth, role, active, has creator_profile]
          → buildUniqueListingSlug()            [slug-2, slug-3, ..., slug-20, then random]
          → createListing()                     [insert row, status='draft' forced]
  → revalidatePath('/dashboard/creator/listings')
```

---

## Create Listing Flow

1. Creator is authenticated with role=creator, status=active, has creator_profile.
2. Navigates to `/dashboard/creator/listings` → clicks `+ Add Listing`.
3. Goes to `/dashboard/creator/listings/new`.
4. Fills the form: title (required), type (required), category (required), and other optional fields.
5. Submits → `createListingAction(input)` server action is called.
6. Action validates input with Zod, calls service, which enforces ownership + generates slug.
7. Listing created with `status = 'draft'`.
8. Redirected to `/dashboard/creator/listings`.

## Edit Listing Flow

1. Creator clicks "Edit" on a listing row → `/dashboard/creator/listings/[id]/edit`.
2. Server verifies auth + ownership (if `listing.creator_id !== creatorProfile.id` → 404).
3. Form pre-filled with existing values.
4. On submit → `updateListingAction(listingId, input)` server action.
5. Service strips write-protected fields (status, verification_status, creator_id).
6. Redirected to `/dashboard/creator/listings`.

## Public Listing Flow

1. Anyone visits `/listings` → sees grid of approved, non-deleted listings.
2. Clicks a listing card → `/listings/[slug]`.
3. Detail page shown: title, type, category, creator name/link, price, availability flags, description, metadata.
4. CTAs (Buy Now, Send Inquiry, Custom Order) are **visually disabled** with module references.

---

## Slug Generation

- `generateSlug(title)` → lowercase, trim, sanitize, hyphenate (max 60 chars).
- Base slug tried first: `handmade-clay-pot`
- If taken: `handmade-clay-pot-2`, `handmade-clay-pot-3`, ..., `handmade-clay-pot-20`
- Emergency fallback after 20 attempts: `handmade-clay-pot-<random hex>`
- Slug is **set once at creation and never changed on edit** (prevents broken URLs).

---

## Metadata (jsonb)

Flexible per-listing fields stored in `metadata` column. Module 5 supports:

| Field | Type | Label |
|---|---|---|
| `deliveryDays` | number | Delivery Days |
| `material` | string | Material |
| `techStack` | string | Tech Stack |
| `revisionCount` | number | Revisions Included |
| `fileFormats` | string | File Formats |

Additional fields can be added later without schema migrations.

---

## Applying the Migration

```bash
# Apply all migrations in order
supabase db push

# Or manually run in Supabase SQL Editor:
# 001_foundation.sql → 002_creator_profiles.sql → 003_listings.sql
```

---

## What Is Intentionally Not Implemented Yet

- Media upload for listing cover images (Module 6)
- Inquiry/messaging (Module 8)
- Custom order requests (Module 9)
- Orders and checkout (Module 10)
- Payments via Razorpay (Module 11)
- Reviews and ratings (Module 12)
- Verification workflow (Module 13)
- Admin listing approval UI (Module 15)
- Listing search/filter on `/listings` (Module 7: Search)
- Pagination on public listings page

---

## Next Module: Module 6 — Media Upload

Module 6 will implement:
- Cloudflare R2 integration
- Profile image upload for creator profiles
- Listing cover image/media upload
- `media_assets` table
- Secure signed upload URLs
