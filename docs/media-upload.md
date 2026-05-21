# Media Upload — Rosovia Module 6

## Scope

Module 6 implements the Media Upload foundation using Cloudflare R2. Creators can upload profile images and listing images. Large files bypass the Next.js server via a direct browser-to-R2 upload flow.

**In scope:**
- `media_assets` database table, migration, and RLS (6 policies)
- Zod validators for signed upload requests and metadata completion
- TypeScript types for `MediaAsset`, `MediaType`, `MediaStatus`, `MediaUsage`
- Cloudflare R2 integration (`@aws-sdk/client-s3`, presigned PUT URLs)
- Storage key generation with safe folder structure
- `/api/media/signed-upload` route handler (server-derived signed URL)
- `/api/media/complete` route handler (server-derives `owner_id`, `public_url`, `storage_provider`)
- `MediaUpload` reusable component (file input, validation, XHR progress, error/success state)
- `ProfileImageUpload` component integrated into creator profile edit page
- `ListingMediaUpload` component integrated into listing edit page (minimal)
- Public vs private media storage path logic
- Documentation

**Out of scope (future modules):**
- Video thumbnail generation — future work
- Signed download URLs for private media
- Media library / gallery management
- Image reordering or cover selector
- Image moderation / AI tagging
- Video processing / Cloudflare Stream
- Verification document upload UI — Module 13
- Inquiries — Module 8
- Orders/Payments — Modules 10-11

---

## Database: `public.media_assets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid FK | → `profiles.id`, CASCADE delete |
| `listing_id` | uuid FK | → `listings.id`, SET NULL on delete |
| `media_type` | text | image / video / document |
| `storage_provider` | text | cloudflare_r2 (only valid value) |
| `storage_key` | text | Unique. Path in R2 bucket. |
| `public_url` | text | null for private media |
| `thumbnail_url` | text | null for Module 6 (future work) |
| `size_bytes` | bigint | > 0 |
| `mime_type` | text | e.g. image/jpeg |
| `duration_seconds` | integer | null for images/documents |
| `is_private` | boolean | Derived from storage key prefix |
| `status` | text | uploaded / processing / ready / failed / deleted |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

### Constraints
- `media_type` IN ('image', 'video', 'document')
- `storage_provider` IN ('cloudflare_r2')
- `status` IN ('uploaded', 'processing', 'ready', 'failed', 'deleted')
- `size_bytes > 0`
- `duration_seconds IS NULL OR duration_seconds >= 0`
- `storage_key` UNIQUE

---

## RLS Policies (6 total)

| Policy | Who | Type | Condition |
|---|---|---|---|
| `public can read public ready` | Any | SELECT | `is_private=false`, `status IN ('uploaded','ready')`, `deleted_at IS NULL` |
| `owner can read own` | Authenticated | SELECT | Owns media via `profiles.auth_user_id = auth.uid()` |
| `owner can insert own` | Authenticated | INSERT | Ownership check + `status IN ('uploaded','processing')` |
| `owner can update own` | Authenticated | UPDATE | Ownership check in USING + cannot transfer (CHECK) |
| `admin can read all` | Admin | SELECT | `is_admin()` |
| `admin can update all` | Admin | UPDATE | `is_admin()` |

> **Private media** is never publicly readable. `public_url` is only set by the server when `storageKey` starts with `public/`.

---

## Direct Browser Upload Flow

```
1. User selects file → client validates type + size immediately
2. Browser POST /api/media/signed-upload  { fileName, mimeType, sizeBytes, usage, ... }
3. Server: validates Zod schema → authenticates user → checks listing ownership if needed
         → generates safe storageKey → creates presigned PUT URL
         → returns { signedUrl, storageKey, publicUrl, expiresIn }
4. Browser PUT file directly to R2 using XHR (with Content-Type header, progress tracking)
5. Browser POST /api/media/complete  { storageKey, mimeType, sizeBytes, mediaType, usage, ... }
6. Server: derives owner_id from auth user → derives public_url from CLOUDFLARE_R2_PUBLIC_URL env var
         → verifies storageKey path prefix belongs to user → verifies listing ownership if applicable
         → inserts media_assets row → if profile_image: updates creator_profiles.profile_image_url
         → returns { media }
7. UI updates preview / shows success state
```

---

## Public vs Private Media

| Context | Storage Key Prefix | Public URL |
|---|---|---|
| Profile image | `public/profiles/{profileId}/` | `{R2_PUBLIC_URL}/{storageKey}` |
| Listing image | `public/listings/{listingId}/` | `{R2_PUBLIC_URL}/{storageKey}` |
| Verification document | `private/users/{profileId}/` | `null` (never set) |
| General private | `private/users/{profileId}/` | `null` |

The server **always derives** `is_private` from whether `storageKey.startsWith('private/')`. The client cannot set this.

---

## File Validation Rules

| Usage | Allowed Types | Max Size |
|---|---|---|
| profile_image | JPEG, PNG, WebP | 5 MB |
| listing_media (image) | JPEG, PNG, WebP | 10 MB |
| listing_media (video) | MP4, WebM | 50 MB |
| verification_document | PDF, JPEG, PNG | 10 MB |
| general | All above | 10 MB |

Validation runs on both client (fast feedback) and server (authoritative).

---

## Storage Key Generation

```
public/profiles/{profileId}/{uuid}-{sanitized-filename}    ← profile image
public/listings/{listingId}/{uuid}-{sanitized-filename}    ← listing image
private/users/{profileId}/{uuid}-{sanitized-filename}      ← private media
```

- File names are lowercased and sanitized (only `a-z`, `0-9`, `.`, `-`, `_`).
- UUID prefix ensures no collisions.
- Path traversal is prevented by sanitization.

---

## Profile Image Integration

1. Creator opens `/dashboard/creator/profile/edit`.
2. `ProfileImageUpload` component is rendered (shows current avatar + change button).
3. Creator picks image → client validates type/size → requests signed URL.
4. Browser uploads directly to R2.
5. Server saves `media_assets` row.
6. Server updates `creator_profiles.profile_image_url` with the public URL.
7. Avatar preview updates immediately in the UI.

---

## Listing Image Foundation

1. Creator opens `/dashboard/creator/listings/[id]/edit`.
2. `ListingMediaUpload` component renders below the form with any existing images.
3. Creator uploads an image → same signed URL flow.
4. `media_assets` row saved with `listing_id`.
5. Uploaded image thumbnails appear in the component.

> Full gallery management (reorder, cover selection, delete UI) is future polish.

---

## Environment Variables

Add to `.env.local` in `apps/web` (or root `.env.local`):

```env
CLOUDFLARE_R2_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_R2_ACCESS_KEY_ID=<your-access-key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your-secret-key>
CLOUDFLARE_R2_BUCKET_NAME=<your-bucket-name>
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev  # or your custom domain
```

> ⚠️ **Never expose** `CLOUDFLARE_R2_ACCESS_KEY_ID` or `CLOUDFLARE_R2_SECRET_ACCESS_KEY` to the browser. They are used only in server-side route handlers.

---

## Applying the Migration

```bash
supabase db push
# Or manually apply packages/database/supabase/migrations/004_media_assets.sql
```

---

## What Is Intentionally Not Implemented

- Video thumbnail generation (future work)
- Signed download URLs for private media
- Media library page
- Image reordering / cover selection
- Delete image UI (service function exists, no UI)
- Verification document upload UI (Module 13)
- Image moderation / AI tagging
- Video processing / Cloudflare Stream

---

## Next Module: Module 7 — Explore / Search

Module 7 will implement:
- Creator discovery page (`/creators` with filters)
- Listing search (`/listings` with category, type, price filters)
- Full-text search integration
- Pagination for public listings and creator listings
