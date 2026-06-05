# Rosovia Social-Commerce Layer

## Overview

This document describes the social-discovery layer added in the **042/043 migrations**, which extends Rosovia from a pure creator marketplace to a **marketplace-first, social-discovery platform**.

---

## New Database Objects

### `creator_posts`
Creator work posts — images, short videos, portfolio case studies, listing showcases, and carousels. Posts are **always pending moderation first** and become public only after admin approval.

| Field | Type | Notes |
|---|---|---|
| `creator_profile_id` | uuid | Owning creator |
| `post_type` | text | image / short_video / portfolio / listing_showcase / carousel |
| `visibility` | text | public / followers / private |
| `moderation_status` | text | pending (default) / approved / rejected / hidden |
| `like_count`, `view_count`, `save_count` | int | Counters, never set by client directly |

**RLS Rules:**
- Public can only read `visibility = public AND moderation_status = approved`
- Creators can read/insert/update/delete only their own posts
- Creator inserts are always `moderation_status = 'pending'`
- Admins can update any post (including moderation_status)

### `creator_post_media`
Join table linking creator posts to `media_assets`. Supports ordered carousels.

### `creator_follows`
Unique pair `(follower_profile_id, creator_profile_id)`. Unique constraint prevents duplicate follows.

---

## Extensions to Existing Tables

### `custom_orders.conversation_id` (nullable)
When a buyer creates a custom order, a conversation is automatically linked and a summary message is posted. This creates a messaging thread for the order without requiring extra steps.

### `reviews.creator_reply` + `creator_replied_at`
Creators can reply to reviews on their profile. A new RLS policy allows creators to update **only their own received reviews** (only the reply fields). Service layer enforces: reply cannot be set more than once (if `creator_replied_at` already set), reply max 2000 chars.

---

## API Services

### Post Service (`packages/api/src/posts/`)
- `getPublicWorkFeed(supabase, params)` — paginated work feed, no auth required
- `createCreatorPost(supabase, input)` — validates media ownership, listing ownership, MIME type; creates post + media
- `updateCreatorPost(supabase, postId, input)` — safe field update (caption, visibility) only
- `deleteCreatorPost(supabase, postId)` — soft delete
- `listCreatorOwnPosts(supabase, params)` — dashboard listing with all statuses
- `adminModeratePost(supabase, postId, status)` — admin moderation with creator notification

### Follow Service (`packages/api/src/follows/`)
- `followCreator(supabase, { creatorProfileId })` — validates target is active, prevents self-follow, notifies creator
- `unfollowCreator(supabase, { creatorProfileId })` — cleans up follow row
- `isCurrentUserFollowing(supabase, creatorProfileId)` — SSR follow state

---

## Explore Page Changes

`/explore` now has three tabs:
1. **Listings** — existing listing cards
2. **Work Feed** — creator post grid (public + approved only)
3. **Creators** — creator profile cards

Tabs are URL-driven (`?tab=listings|work|creators`) — no JS required to load.

---

## Creator Profile Changes

`/creators/[slug]` now shows:
- **Follow button** — authenticated users can follow/unfollow
- **Message button** — links to `/dashboard/messages?creator=<id>`
- **Work tab** — shows creator's approved public posts
- Trust stats row includes `total_followers` from the existing counter column

---

## Notification Types Added

| Type | Trigger |
|---|---|
| `new_follower` | User follows a creator |
| `post_approved` | Admin approves a post |
| `post_rejected` | Admin rejects a post |
| `post_liked` | Reserved for future like feature |
| `review_reply` | Creator replies to a review |

---

## Payment Safety

All payment paths remain guarded by `isPaymentsEnabled()`. The social-commerce layer adds zero payment code — it only adds portfolio visibility, messaging entry points, and custom order conversation linking.

See `docs/payments-and-payouts.md` for full payment architecture.
