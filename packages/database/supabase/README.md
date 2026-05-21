# Rosovia — Database Package

## Purpose

This package (`@rosovia/database`) is the single source of truth for all Supabase database concerns:
- SQL migration files
- Seed data
- TypeScript types (auto-generated or placeholder)

It does **not** contain any runtime code that is imported by the web app at this stage. Types in `src/database.types.ts` will be imported by `packages/integrations` and `apps/web` in later modules.

---

## Module 2 Scope

The following have been implemented in Module 2: Database Foundation.

### Tables Created
- **`public.profiles`** — one row per Supabase Auth user; soft-delete via `deleted_at`.
- **`public.categories`** — platform-managed categories; not user-created.

### Functions Created
- **`public.set_updated_at()`** — trigger function to auto-stamp `updated_at`.
- **`public.is_admin()`** — security-definer helper used inside RLS policies.

### Migration File
- `packages/database/supabase/migrations/001_foundation.sql`

### Seed File
- `packages/database/supabase/seed.sql`

---

## Prerequisites

Install the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npm install -g supabase
# or via brew on macOS
brew install supabase/tap/supabase
```

---

## How to Apply the Migration

### Option A: Using Supabase Cloud (Recommended for now)

```bash
# Log in
supabase login

# Link your project (one-time)
supabase link --project-ref YOUR_PROJECT_REF

# Push migration to your remote project
supabase db push
```

### Option B: Local Development

```bash
# Start local Supabase stack
supabase start

# Apply migrations to local DB
supabase db reset
```

> `supabase db reset` drops and re-creates the local database, applying all migrations in order and then running `seed.sql`.

---

## How to Seed Categories

After applying the migration, run the seed against your local or remote database:

### Local
```bash
supabase db reset
# seed.sql is automatically applied during reset if placed in supabase/seed.sql
```

### Remote (manual)
Connect via your Supabase dashboard SQL Editor and paste the contents of `supabase/seed.sql`, or use `psql`:

```bash
psql "$DATABASE_URL" -f packages/database/supabase/seed.sql
```

The seed uses `ON CONFLICT (slug) DO UPDATE` so it is **safe to run multiple times**.

---

## How to Reset the Local Database

```bash
supabase db reset
```

This wipes the local database and re-applies all migrations and the seed file cleanly.

---

## How to Generate Database Types

After your project schema is finalised:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF \
  > packages/database/src/database.types.ts
```

This replaces the placeholder `database.types.ts` with real generated types.

---

## How to Test Basic RLS

You can test RLS using the Supabase dashboard's "SQL Editor" or `psql`. Examples:

```sql
-- Verify a regular user cannot see another user's profile (should return 0 rows)
set role authenticated;
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001"}';
select * from public.profiles where auth_user_id != '00000000-0000-0000-0000-000000000001';

-- Verify categories are publicly readable
set role anon;
select * from public.categories where is_active = true;
```

**Important Notes for RLS Testing:**
- SQL Editor claim simulation (`request.jwt.claims`) may vary depending on Supabase/PostgREST configuration.
- The most reliable test is to create real test users through the Supabase Auth dashboard and verify profile access through the authenticated client application.
- Never expose the `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- The service role bypasses RLS and must only be used in trusted server/admin code.

---

## What Is Intentionally Not Included

The following will be built in later modules and are **not** part of Module 2:

- User authentication flows
- Creator profiles / listings
- Products, services, orders
- Payments, media uploads
- Reviews, reports, verifications
- Admin CRUD tables
- Any API routes or server actions

---

## Module 7 Addition — Migration 005

### Migration File
- `packages/database/supabase/migrations/005_explore_search_indexes.sql`

### Purpose
Adds search performance indexes. Fully additive — no table changes, no column drops, no data model changes.

### What is added
- `pg_trgm` extension (enables trigram GIN indexes for fast ILIKE search)
- GIN trigram indexes: `listings.title`, `listings.description`, `creator_profiles.display_name`, `creator_profiles.bio`
- Partial compound index: approved + non-deleted listings ordered by `created_at`
- `lower(...)` indexes on `listings.title`, `listings.city`, `listings.state`, `creator_profiles.display_name`
- Category indexes: `is_active + priority`, `type`, `lower(name)`

### How to apply
```bash
supabase db push
# or for local:
supabase db reset
```

