# Media Upload — Rosovia

## Overview

Rosovia uses **Cloudflare R2** for object storage. Files are uploaded directly from the browser to R2 via a presigned PUT URL — bypassing the Next.js server to avoid upload size limits and minimize server load.

All media metadata is recorded in the `public.media_assets` table in Supabase.

---

## Upload Flow

```
1. User selects a file in the browser
   └─ Client validates: file type, file size (fast feedback)

2. Browser → POST /api/media/signed-upload
   Body: { fileName, mimeType, sizeBytes, usage, listingId? }
   └─ Server:
       ├─ Authenticate user (getUser)
       ├─ Validate with Zod schema
       ├─ Generate storageKey with safe path prefix and UUID
       ├─ Create presigned PUT URL via AWS S3 SDK (R2 compatible)
       └─ Return: { signedUrl, storageKey, publicUrl, expiresIn }

3. Browser → PUT file directly to R2
   Using XHR with Content-Type header and upload progress tracking
   (No Next.js server involved in the actual file transfer)

4. Browser → POST /api/media/complete
   Body: { storageKey, mimeType, sizeBytes, mediaType, usage, ... }
   └─ Server:
       ├─ Authenticate user (getUser)
       ├─ Derive owner_id from authenticated profile
       ├─ Derive public_url from CLOUDFLARE_R2_PUBLIC_URL (never from client)
       ├─ Derive is_private from storageKey prefix
       ├─ Verify storageKey path belongs to this user
       ├─ INSERT into public.media_assets
       ├─ If usage = 'profile_image': UPDATE creator_profiles.profile_image_url
       └─ Return: { media }

5. UI updates (avatar preview, listing image thumbnail)
```

---

## Public vs Private Media

| Context | Storage Key Prefix | `public_url` Set? | Accessible Publicly? |
|---|---|---|---|
| Profile image | `public/profiles/{profileId}/` | ✅ Yes | ✅ After `status = ready` |
| Listing image | `public/listings/{listingId}/` | ✅ Yes | ✅ After `status = ready` AND listing `status = approved` |
| Verification document | `private/users/{profileId}/` | ❌ Never | ❌ Admin signed URL only |
| General private | `private/users/{profileId}/` | ❌ Never | ❌ Admin signed URL only |

The server **always derives** `is_private` from whether `storageKey.startsWith('private/')`. The client cannot set `is_private` directly.

---

## Media Visibility Rules

Public media is only exposed when:
- `is_private = false`
- `status IN ('uploaded', 'ready')`
- `deleted_at IS NULL`

Verification documents and private media:
- **Never** have a `public_url` set — the column is always `null`
- Are only accessible via admin signed read URLs issued by `/api/admin/media/[id]/signed-read-url`
- The admin route requires an active admin session (server-side check); it generates a time-limited presigned GET URL from R2

---

## Protected Columns (Migration 022)

Migration `022_media_protected_columns.sql` adds a PostgreSQL policy that prevents authenticated users from modifying:

- `is_private` — cannot be changed after upload
- `storage_key` — immutable once set

These columns can only be modified by the service-role client (server-side API routes).

---

## Database: `public.media_assets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid FK | → `profiles.id`, CASCADE delete |
| `listing_id` | uuid FK | → `listings.id`, SET NULL on delete |
| `media_type` | text | `image` / `video` / `document` |
| `storage_provider` | text | `cloudflare_r2` (only valid value) |
| `storage_key` | text | Unique. Path in R2 bucket. Protected column. |
| `public_url` | text | null for private media |
| `thumbnail_url` | text | null (future: generated thumbnails) |
| `size_bytes` | bigint | > 0 |
| `mime_type` | text | e.g. `image/jpeg` |
| `duration_seconds` | integer | null for images/documents |
| `is_private` | boolean | Derived from storage key prefix. Protected column. |
| `status` | text | `uploaded` / `processing` / `ready` / `failed` / `deleted` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto via trigger |
| `deleted_at` | timestamptz | Soft delete |

---

## RLS Policies

| Policy | Who | Operation | Condition |
|---|---|---|---|
| Public reads public ready | Anyone | SELECT | `is_private=false`, `status IN ('uploaded','ready')`, `deleted_at IS NULL` |
| Owner reads own | Authenticated | SELECT | Owner via `profiles.auth_user_id = auth.uid()` |
| Owner inserts own | Authenticated | INSERT | Ownership check + `status IN ('uploaded','processing')` |
| Owner updates own | Authenticated | UPDATE | Cannot change `is_private` or `storage_key` (protected) |
| Admin reads all | Admin | SELECT | `is_admin()` |
| Admin updates all | Admin | UPDATE | `is_admin()` |

---

## File Validation Rules

| Usage | Allowed MIME Types | Max Size |
|---|---|---|
| `profile_image` | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| `listing_media` (image) | `image/jpeg`, `image/png`, `image/webp` | 10 MB |
| `listing_media` (video) | `video/mp4`, `video/webm` | 50 MB |
| `verification_document` | `application/pdf`, `image/jpeg`, `image/png` | 10 MB |
| general | All above | 10 MB |

Validation runs on both client (immediate feedback) and server (authoritative enforcement).

---

## Storage Key Structure

```
public/profiles/{profileId}/{uuid}-{sanitized-filename}     ← profile image
public/listings/{listingId}/{uuid}-{sanitized-filename}     ← listing image
private/users/{profileId}/{uuid}-{sanitized-filename}       ← verification document / private
```

- File names are sanitized: lowercased, only `a-z`, `0-9`, `.`, `-`, `_` allowed.
- UUID prefix prevents collisions and path traversal.

---

## Environment Variables

```env
# Required for all media upload flows
CLOUDFLARE_R2_ACCOUNT_ID=your-cf-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

All R2 credentials are server-only. They are used only in API route handlers. The browser never receives them.

---

## Admin Signed Read URLs

For verification documents and other private media, admins can obtain a temporary signed read URL:

```
GET /api/admin/media/[id]/signed-read-url
```

- Requires active admin session
- Returns a presigned R2 GET URL (time-limited, typically 60 minutes)
- The URL is not stored in the database — it is generated on demand
- Used in the admin verification review page to view document thumbnails/PDFs

---

## Current Limitations

| Feature | Status |
|---|---|
| Video thumbnail generation | ❌ Not implemented (future work) |
| Media library / gallery management | ❌ Not implemented |
| Image reordering / cover selection | ❌ Not implemented |
| Delete image UI | ❌ Service function exists; no UI |
| AI/ML content moderation | ❌ Not implemented |
| Video processing / Cloudflare Stream | ❌ Not implemented |
| Image CDN transforms (resize, WebP) | ❌ Not implemented |
