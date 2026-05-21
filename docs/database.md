# Database Architecture — Rosovia

## Decision: Supabase PostgreSQL with SQL Migrations

Rosovia uses Supabase PostgreSQL as its database. All schema changes are managed as raw SQL migration files inside `packages/database/supabase/migrations/`. No ORM (Prisma/Drizzle) is used.

---

## profiles Table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, auto-generated |
| `auth_user_id` | `uuid` | FK to `auth.users(id)`, unique, cascade delete |
| `full_name` | `text` | Nullable |
| `username` | `text` | Unique, nullable |
| `email` | `text` | Nullable |
| `phone` | `text` | Nullable |
| `avatar_url` | `text` | Nullable |
| `role` | `text` | `buyer` \| `creator` \| `admin`, default `buyer` |
| `city`, `state`, `country` | `text` | Location; `country` default `India` |
| `language` | `text` | Nullable |
| `is_seller` | `boolean` | Default `false` |
| `is_mentor` | `boolean` | Default `false` |
| `is_business` | `boolean` | Default `false` |
| `is_service_provider` | `boolean` | Default `false` |
| `status` | `text` | `active` \| `suspended` \| `deleted`, default `active` |
| `created_at` | `timestamptz` | Auto-set |
| `updated_at` | `timestamptz` | Auto-updated via trigger |
| `deleted_at` | `timestamptz` | Soft-delete; null means active |

---

## categories Table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, auto-generated |
| `name` | `text` | Not null |
| `slug` | `text` | Unique, not null |
| `description` | `text` | Nullable |
| `priority` | `integer` | Display order |
| `type` | `text` | `product` \| `service` \| `learning` \| `performance` \| `mixed` |
| `icon_name` | `text` | Lucide icon name |
| `is_active` | `boolean` | Default `true` |
| `created_at` | `timestamptz` | Auto-set |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

---

## Indexes

### profiles
- `profiles_username_idx` on `(username)`
- `profiles_role_idx` on `(role)`
- `profiles_auth_user_id_idx` on `(auth_user_id)`
- `profiles_status_idx` on `(status)`

### categories
- `categories_slug_idx` on `(slug)`
- `categories_priority_idx` on `(priority)`
- `categories_is_active_idx` on `(is_active)`
- `categories_type_idx` on `(type)`

---

## RLS Summary

Both tables have RLS enabled.

### profiles
| Policy | Operation | Condition |
|---|---|---|
| User reads own | `SELECT` | `auth.uid() = auth_user_id` |
| User inserts own | `INSERT` | `auth.uid() = auth_user_id`, role must be `buyer`/`creator` |
| User updates own | `UPDATE` | `auth.uid() = auth_user_id`, role escalation to admin blocked |
| Admin reads all | `SELECT` | `is_admin()` |
| Admin updates all | `UPDATE` | `is_admin()` |

### categories
| Policy | Operation | Condition |
|---|---|---|
| Public reads active | `SELECT` | `is_active = true` (no auth required) |
| Admin inserts | `INSERT` | `is_admin()` |
| Admin updates | `UPDATE` | `is_admin()` |
| Admin deletes | `DELETE` | `is_admin()` |

---

## Seeded Categories

9 categories are seeded in `seed.sql`:

1. Handmade Gifts / Handmade Products — `product`
2. Painting / Sketching / Digital Art — `learning`
3. Pottery / Matti ki Murti / Clay Art — `product`
4. Coding / Web Development / App Development — `service`
5. Graphic Design / Logo / Poster / UI Design — `service`
6. Dance / Music / Singing — `performance`
7. Photography / Videography / Editing — `service`
8. Teaching / Mentorship / Skill Learning — `learning`
9. Fashion / Handmade Clothes / Jewellery — `product`

---

## Future Tables (Planned, Not Yet Created)

These will be added in later modules and are **not** part of Module 2:

- `creator_profiles` — extended creator metadata (Module 3/4)
- `listings` — products and services listed by creators (Module 5)
- `orders` — buyer-creator transactions (Module 5)
- `custom_orders` — custom commission requests (Module 5)
- `reviews` — verified buyer reviews (Module 6)
- `media_assets` — Cloudflare R2-backed media references (Module 5)
- `reports` — user-submitted content reports (Module 7)
- `verifications` — admin-managed creator verification records (Module 7)
- `payments` — Razorpay payment records (Module 5)
