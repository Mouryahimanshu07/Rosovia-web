# Rosovia Deployment Checklist: Vercel & Supabase

This guide provides step-by-step instructions for deploying the Rosovia platform, connecting it to Supabase, and configuring Vercel.

## 1. Local Setup Steps

1. Clone the repository to your local machine.
2. Ensure you have the required Node.js and pnpm versions installed.
3. Run `pnpm install` at the root of the workspace.
4. Copy `packages/database/.env.example` to `packages/database/.env` and `.env.example` to `.env.local` at the root of the project.

## 2. Required Versions

- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.0.0` or higher (run `corepack enable` and `corepack prepare pnpm@9.0.0 --activate` if needed).

## 3. Supabase Project Setup

1. Create a new project in the [Supabase Dashboard](https://database.new).
2. Note your Project URL and Anon Key from **Project Settings > API**.
3. Note your Service Role Key (Keep this secret!).
4. Note your Database Password.

## 4. Supabase Environment Variable List

Add the following to your `.env.local` (local) and Vercel Environment Variables (production):

```env
# Required for browser and server clients
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for admin bypass (Server only, DO NOT use NEXT_PUBLIC prefix)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for migrations
DATABASE_URL=postgres://postgres.[project-ref]:[db-password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## 5. Migration Apply Steps

To apply the database migrations to your Supabase project:

1. Link your local project to the Supabase project:
   ```bash
   cd packages/database
   npx supabase link --project-ref <your-project-ref>
   ```
2. Push the migrations to the remote database:
   ```bash
   npx supabase db push
   ```

Alternatively, you can manually copy and execute the SQL files in `packages/database/supabase/migrations` sequentially (001 to 014) in the Supabase SQL Editor.

## 6. Seed Apply Steps

If you need to seed initial categories or test data:
Run the seed file using the Supabase CLI or SQL Editor:
```bash
npx supabase db reset # (This drops data, only use for local/test)
```
Or execute `packages/database/supabase/seed.sql` in the SQL Editor.

## 7. Auth Redirect URL Setup

Go to **Authentication > URL Configuration** in Supabase and configure the Site URL and Redirect URIs.

- **Local URL**: `http://localhost:3000`
- **Vercel Preview URL**: `https://*vercel.app` (Enable wildcard previews if desired).
- **Production URL**: `https://your-production-domain.com`

Make sure to add `http://localhost:3000/auth/callback` (and the equivalent production callback) to your allowed redirect URIs.

## 8. Vercel Setup Steps

1. Push your code to GitHub.
2. Import the project into Vercel.
3. Configure the project settings as follows:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (or leave root if Vercel auto-detects Turbo, but usually `apps/web` is safer if the build command is configured correctly, however since it's a turborepo, leave Root Directory empty and let Vercel use Turborepo defaults).
   - **Install Command**: `pnpm install`
   - **Build Command**: `pnpm run build` (This runs `turbo run build` from the root).
   - **Output Directory**: `.next`

## 9. Vercel Environment Variables

In the Vercel dashboard, add all variables from step 4, plus any storage variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...

# Storage (if using Cloudflare R2)
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=...
CLOUDFLARE_R2_PUBLIC_URL=...
```

## 10. Build Command

The optimal build command is set in the root `package.json`:
```bash
pnpm run build
```
This leverages Turbo to build dependencies (`@rosovia/core`, `@rosovia/api`, etc.) in the correct order before building the Next.js app.

## 11. Common Deployment Errors and Fixes

- **Type errors on build**: Vercel runs a strict production build. If it fails due to typecheck, run `pnpm typecheck` locally to find and fix the issue. (Our audit confirmed all types currently pass).
- **Missing Env Vars**: Next.js will crash at runtime if server-side env vars like `SUPABASE_SERVICE_ROLE_KEY` are missing. Double-check the Vercel env settings.
- **Turborepo cache misses**: Ensure the `turbo.json` outputs include `.next/**` and `!.next/cache/**`.

## 12. Final Production Checklist

- [ ] Supabase Project Created.
- [ ] Migrations pushed successfully.
- [ ] Authentication Site URL and Redirect URIs configured in Supabase.
- [ ] Vercel project connected to GitHub repository.
- [ ] All environment variables added to Vercel (Production and Preview environments).
- [ ] Domain mapped in Vercel settings.
- [ ] First deployment triggered and successful.
- [ ] Tested signup/login flow on the live domain.
