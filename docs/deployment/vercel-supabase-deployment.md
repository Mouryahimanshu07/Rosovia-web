# Rosovia Deployment Checklist: Vercel & Supabase

This guide provides step-by-step instructions for deploying the Rosovia platform to Vercel, connected to Supabase and Cloudflare R2.

---

## 1. Prerequisites

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.0.0 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- Supabase account and project created
- Cloudflare R2 bucket created
- Razorpay account configured
- GitHub repository with the Rosovia codebase

---

## 2. Supabase Project Setup

1. Create a project at [database.new](https://database.new).
2. From **Project Settings → API**, note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` (**keep secret**)
3. From **Project Settings → Database**, note:
   - **Connection string (pooler)** → `DATABASE_URL`

---

## 3. Apply All Migrations

Link your local Supabase CLI to the remote project and push all 27 migrations in order:

```bash
# From project root
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations from 001 to 027
supabase db push
```

> Alternatively, paste the SQL files into the Supabase SQL Editor in numeric order (001 → 027).

### Verify Migrations

In the Supabase Dashboard → Database → Tables, confirm these tables exist:

`profiles`, `categories`, `creator_profiles`, `listings`, `media_assets`, `inquiries`, `custom_orders`, `orders`, `order_status_history`, `payments`, `reviews`, `verification_requests`, `reports`, `admin_actions`, `refund_requests`, `disputes`, `creator_payouts`, `messages`, `notifications`, `order_deliveries`

---

## 4. Seed Categories

```bash
# Local/dev only — drops and resets all data
supabase db reset

# Or run seed.sql in Supabase SQL Editor for production seed only
# File: packages/database/supabase/seed.sql
```

---

## 5. Generate TypeScript Database Types

After migrations are applied, regenerate the TypeScript types and commit the result:

```bash
supabase gen types typescript --schema public \
  > packages/database/src/database.types.ts
```

Commit the updated file so the build picks up current table types.

---

## 6. Auth Redirect URL Setup

In Supabase → **Authentication → URL Configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://your-production-domain.com` |
| Redirect URLs | `http://localhost:3000/auth/callback` (local), `https://your-production-domain.com/auth/callback` (prod) |

---

## 7. Cloudflare R2 Setup

1. Create an R2 bucket in the Cloudflare Dashboard.
2. Create an R2 API token with Object Read & Write permissions.
3. Configure a custom domain or use the default `pub-xxx.r2.dev` public URL.
4. Set CORS policy on the bucket to allow PUT requests from your domain:

```json
[
  {
    "AllowedOrigins": ["https://your-production-domain.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 8. Razorpay Webhook Configuration

In the Razorpay Dashboard → **Settings → Webhooks**:

1. Add webhook endpoint: `https://your-production-domain.com/api/webhooks/razorpay`
2. Enable events: `payment.captured`, `payment.failed`
3. Copy the webhook secret → `RAZORPAY_WEBHOOK_SECRET`

---

## 9. Environment Variables Reference

All required variables — see [docs/env.md](../env.md) for full documentation.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Sentry (optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=      # CI/CD secrets only
SENTRY_ORG=
SENTRY_PROJECT=

# PostHog (optional but recommended)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 10. Vercel Project Setup

1. Push code to GitHub.
2. Import the project in [vercel.com/new](https://vercel.com/new).
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: leave empty (Turborepo auto-detection)
   - **Install Command**: `pnpm install`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `.next`
4. Add all environment variables from step 9 in **Settings → Environment Variables** (Production + Preview).

> ⚠️ Set `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` as **encrypted** Vercel secrets. Never add `SENTRY_AUTH_TOKEN` to environment variables — use Vercel's CI/CD integration secrets instead.

---

## 11. Build Command Details

The root `package.json` defines:

```bash
pnpm run build  →  turbo run build
```

Turborepo builds packages in dependency order:
1. `@rosovia/core` (types, validators)
2. `@rosovia/database` (DB types)
3. `@rosovia/ui` (UI components)
4. `@rosovia/api` (repositories, services)
5. `web` (Next.js app)

---

## 12. First Deployment Verification

After your first deployment:

- [ ] Visit `https://your-domain.com/api/health` → expect `{ "status": "ok" }`
- [ ] Signup flow works end-to-end
- [ ] Login and session persistence works
- [ ] Explore page loads listings (after categories seeded + at least one listing approved)
- [ ] Media upload works (profile image)
- [ ] Razorpay checkout opens in test mode

---

## 13. Common Deployment Errors

| Error | Cause | Fix |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY not found` | Missing env var | Add to Vercel production env |
| Type errors on build | Type mismatch after migration | Regenerate `database.types.ts` and commit |
| `Edge runtime error` | Server-only import in edge middleware | Move import to server component |
| `R2 presigned URL 403` | CORS policy missing or wrong origin | Update R2 CORS config |
| `Webhook 400 Bad Request` | Signature mismatch | Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard value |
| Turborepo cache misses | `turbo.json` outputs not covering `.next` | Verify `.next/**` in `turbo.json` outputs |

---

## 14. Final Deployment Checklist

- [ ] Supabase project created
- [ ] All 27 migrations pushed
- [ ] Auth Site URL and Redirect URIs configured
- [ ] Seed categories applied
- [ ] Admin account created (`role = admin`, `status = active`)
- [ ] Cloudflare R2 bucket created and CORS configured
- [ ] Razorpay webhook registered
- [ ] All environment variables added to Vercel
- [ ] Domain mapped in Vercel settings
- [ ] First deployment triggered and successful
- [ ] `/api/health` responds correctly
- [ ] Signup/login tested on live domain
- [ ] Database types committed and up to date
