# Creator Profile — Rosovia Module 4

## Scope

Module 4 implements the Creator Profile foundation. It is the layer between a registered creator user and the public-facing listing marketplace (Module 5).

**In scope:**
- `creator_profiles` database table, migration, and RLS
- Zod validators (form-layer and service-layer)
- Service/repository functions in `@rosovia/api`
- Creator onboarding page (`/dashboard/creator/profile/new`)
- Creator edit profile page (`/dashboard/creator/profile/edit`)
- Creator dashboard profile summary (`/dashboard/creator/profile`)
- Public creators list (`/creators`)
- Public creator profile detail (`/creators/[slug]`)
- Slug generation with numeric counter on collision
- Verification badge placeholder component
- Rating summary placeholder component
- Profile card component

**Out of scope (Module 5+):**
- Listings, listing creation, listing cards
- Media upload (profile_image_url and intro_video_url are URL fields only. Media upload is Module 6)
- Inquiries, custom orders, orders, payments
- Reviews
- Verification document upload
- Real follower/order tracking

---

## Database: `public.creator_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | → `profiles.id`, UNIQUE, CASCADE delete |
| `display_name` | text | Required |
| `slug` | text | Unique, URL-safe |
| `bio` | text | Optional, max 500 chars enforced in service |
| `story` | text | Optional, max 2000 chars |
| `primary_category_id` | uuid FK | → `categories.id`, nullable |
| `skills` | text[] | Default `'{}'` |
| `languages` | text[] | Default `'{}'` |
| `city` | text | Optional |
| `state` | text | Optional |
| `country` | text | Default `'India'` |
| `profile_image_url` | text | URL only, no upload in Module 4 |
| `intro_video_url` | text | YouTube/Vimeo URL only |
| `verification_level` | text | `none` / `basic_verified` / `creator_verified` / `seller_verified` / `trusted_seller` |
| `is_verified` | boolean | Default false |
| `rating_avg` | numeric | 0–5, owned by system |
| `rating_count` | integer | ≥ 0, owned by system |
| `total_orders` | integer | ≥ 0, owned by system |
| `total_followers` | integer | ≥ 0, owned by system |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

---

## RLS Summary

| Policy | Who | Type | Condition |
|---|---|---|---|
| `public can read active` | Any | SELECT | `deleted_at IS NULL` |
| `creator can insert own` | Authenticated | INSERT | `profiles.auth_user_id = auth.uid()`, `role = creator`, `status = active` |
| `creator can update own` | Authenticated | UPDATE | Same as insert |
| `admin can read all` | Admin | SELECT | `is_admin()` |
| `admin can update all` | Admin | UPDATE | `is_admin()` |

> **Column-level write protection** (for `is_verified`, `verification_level`, `rating_avg`, `rating_count`, `total_orders`, `total_followers`) is enforced in the service layer. The Zod schemas for creator input do not include these fields, and the `updateCurrentUserCreatorProfile` service function explicitly strips them before calling the repository.

---

## Service / Repository Flow

```
Client Form
  → zodResolver(creatorProfileFormSchema)       [form validation]
  → onSubmit() splits skills/languages          [form → service input]
  → createCurrentUserCreatorProfile(supabase, input)
      → getUser()                               [verify authenticated]
      → getProfileByAuthUserId()                [verify role=creator, status=active]
      → getCreatorProfileByUserId()             [check: not already created]
      → buildUniqueSlug()                       [generate slug, check collision]
      → createCreatorProfile()                  [insert row via RLS]
```

### Slug Generation

1. `generateSlug(displayName)` → lowercase, trim, sanitize, hyphenate (max 60 chars)
2. Check if slug exists in `creator_profiles`
3. If taken: try `slug-2`, `slug-3`, ... up to `slug-10`
4. If all taken: emergency fallback `slug-<random hex>`

---

## Onboarding Flow

1. Creator signs up and logs in at `/login`
2. Navigates to `/dashboard/creator/profile`
3. Sees "Create your creator profile" CTA → clicks → goes to `/dashboard/creator/profile/new`
4. Fills in: Display Name (required), Primary Category (required), Bio, Story, Skills, Languages, City, State, Country, Profile Image URL, Intro Video URL
5. Submits → `createCurrentUserCreatorProfile()` is called client-side with the browser Supabase client
6. On success → redirected to `/dashboard/creator/profile`

## Edit Profile Flow

1. Creator clicks "Edit profile" on the dashboard profile page
2. Goes to `/dashboard/creator/profile/edit`
3. Same form, pre-filled with existing values
4. Submits → `updateCurrentUserCreatorProfile()` called
5. Sensitive fields are never sent to the DB (stripped by service layer)
6. Redirected to `/dashboard/creator/profile`

## Public Creator Profile Flow

1. Anyone visits `/creators` → sees grid of active creator profiles
2. Clicks a creator card → goes to `/creators/[slug]`
3. Sees: name, image, bio, story, skills, languages, location, badge, rating, stats
4. CTA buttons ("Send Inquiry", "Request Custom Order") are disabled with "coming in Module 5" note

---

## What Is Intentionally Not Implemented Yet

- Listings (Module 5)
- Media upload system (profile_image_url is a URL-only field)
- Real verification workflow (badge is a visual placeholder)
- Reviews (rating_avg/rating_count are counters, no review submissions yet)
- Follower system
- Real order tracking
- Admin creator management UI
- Creator search/filtering on `/creators`
- Pagination on `/creators`

---

## Applying the Migration

```bash
# Apply via Supabase CLI
supabase db push

# Or in Supabase SQL Editor — paste contents of:
packages/database/supabase/migrations/002_creator_profiles.sql
```

Make sure migration `001_foundation.sql` has been applied first (it creates `profiles`, `categories`, `is_admin()`, and `set_updated_at()`).

---

## Next Modules

**Module 5: Listings**
Module 5 will implement:
- `listings` database table
- Creator listing creation (without media upload)
- Listing types (product, service, mentorship, performance)
- Listing cards on `/listings` public page
- Individual listing detail page
- Buyer inquiry flow (basic)

**Module 6: Media Upload**
- Cloudflare R2 integration
- Profile image, intro video, and listing media uploads
