# Authentication — Rosovia Module 3

## Auth Flow Overview

Rosovia uses **Supabase Auth** with the `@supabase/ssr` library for server-side session management in Next.js App Router.

```
UI Form (Client Component)
  → React Hook Form + Zod validation
  → Browser Supabase client (anon key only)
  → packages/api auth/profile service functions
  → Supabase Auth / public.profiles (RLS enforced)
```

---

## Signup Flow

1. User fills in: Full Name, Email, Password, Role (`buyer` or `creator`).
2. Client calls `signUpWithEmail()` → `supabase.auth.signUp()`.
3. Role + full name stored in Supabase `user_metadata` (safe, non-admin values only).
4. **If email confirmation is enabled:** User sees "Check your email" message. After clicking the link, Supabase redirects to `/auth/callback?code=...`. The callback exchanges the code, calls `ensureUserProfile()`, and redirects to the correct dashboard.
5. **If email confirmation is disabled:** Session is created immediately. `ensureUserProfile()` is called client-side. User is redirected to their dashboard.

---

## Login Flow

1. User fills in: Email, Password.
2. Client calls `signInWithEmail()` → `supabase.auth.signInWithPassword()`.
3. On success, `ensureUserProfile()` is called (creates profile row if it doesn't exist).
4. Profile `status` is checked — suspended/deleted users are denied.
5. User is redirected based on `profile.role`: `buyer → /dashboard/buyer`, `creator → /dashboard/creator`, `admin → /dashboard/admin`.

---

## Password Reset Flow

1. User submits `/forgot-password` form.
2. `sendPasswordResetEmail()` is called with `redirectTo: ${origin}/auth/callback?redirect_to=/reset-password`.
3. A generic success message is shown regardless of whether the email exists (prevents email enumeration).
4. User clicks the email link → redirected to `/auth/callback` → code exchanged → redirected to `/reset-password`.
5. User sets a new password via the form. `updatePassword()` is called using the active recovery session.

---

## Profile Auto-Creation (`ensureUserProfile`)

Called after every successful login or callback:
1. Gets the current Supabase auth user.
2. Queries `public.profiles` by `auth_user_id`.
3. If profile exists → return it.
4. If not → reads `user_metadata` (full_name, role) and creates a new profile row.
5. **`admin` role is never accepted from metadata.** Only `buyer` or `creator` are allowed. Falls back to `buyer` if missing.
6. Respects RLS — uses the anon key client only.

---

## Role Rules

| Role | Self-select on signup | Notes |
|---|---|---|
| `buyer` | ✅ Yes | Default role |
| `creator` | ✅ Yes | Selected during signup |
| `admin` | ❌ Never | Must be set manually via Supabase Dashboard or future admin process |

---

## Dashboard Protection Rules

| Route | Protection |
|---|---|
| `/dashboard/buyer` | Middleware checks session. Page verifies `profile.role === 'buyer'` and `status === 'active'`. |
| `/dashboard/creator` | Same, checks `role === 'creator'`. |
| `/dashboard/admin` | Same, checks `role === 'admin'`. |

- Unauthenticated users are redirected to `/login` by middleware.
- Wrong-role users are redirected to their correct dashboard.
- Suspended/deleted accounts are redirected to `/login?error=account_suspended`.

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The `SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` for future server-side admin operations only. It must **never** be exposed to client code or committed to version control.

---

## How to Create the First Admin

Admin accounts cannot be created through the public signup UI. To create the first admin:

1. Have the user sign up normally as a `buyer` or `creator`.
2. In the **Supabase Dashboard → Table Editor → `public.profiles`**, find the row.
3. Change the `role` column value to `admin`.

Alternatively, use the Supabase SQL Editor:
```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

> Note: Only do this from the Supabase Dashboard or a trusted server environment using the service role key — never from the app.

---

## What Is Intentionally Not Implemented Yet

- OAuth providers (Google, GitHub, etc.)
- Magic link login
- Phone OTP authentication
- Creator profile onboarding after signup
- Listings, orders, payments, media upload
- Email templates (using Supabase default for now)
- Admin CRUD for user management
