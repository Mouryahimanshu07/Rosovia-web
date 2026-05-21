# Architecture Overview

## Modular Monolith
Rosovia uses a modular monolith approach inside a pnpm monorepo. This provides the development speed of a monolith while enforcing strict boundaries between modules, making future extraction to microservices possible if absolutely necessary, but prioritizing current productivity.

## Package Responsibilities
- `apps/web`: Next.js web application. Handles routing, pages, layouts, and rendering.
- `packages/ui`: Dumb, reusable UI components. No business logic or data fetching.
- `packages/core`: Pure business rules, types, schemas, and constants.
- `packages/integrations`: SDKs and clients for external services (Supabase, Stripe, PostHog, etc).

## Data Flow
UI Component → Validation (Zod) → Server Action / Route Handler → Service Layer → Permission Check → Repository Layer → Database

## Future Upgrades
The modular nature allows easy addition of new apps (e.g., an admin dashboard app or mobile app) that can consume the same `core` and `ui` packages without duplication.
