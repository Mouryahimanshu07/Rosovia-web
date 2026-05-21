# Admin Dashboard

The Admin Dashboard provides full administrative control over the Rosovia marketplace platform. It is a secure, read-and-moderate interface that sits on top of all existing functional modules.

## Features Overview

- **Overview Dashboard:** Top-level metrics on users, creators, verification, moderation, and commerce.
- **User Management:** View all registered users and suspend/reactivate accounts.
- **Creator Management:** View all creator profiles, verification statuses, and connected profiles.
- **Category Management:** Full CRUD interface for listing categories, priority ordering, and active toggles.
- **Listing Moderation:** Review pending listings, approve, reject, suspend, or archive marketplace listings.
- **Review Moderation:** Hide or unhide user reviews to handle abusive or inappropriate feedback.
- **Orders & Payments:** Read-only tracking of all platform orders, custom orders, and Razorpay transactions.
- **Audit Logs:** Immutable tracking of every moderation action taken by any admin.

## Security Architecture

1. **Authentication:** All admin routes and server actions require a valid session.
2. **Authorization:** The `profiles.role` must be exactly `'admin'`.
3. **Status Check:** The admin's `profiles.status` must be `'active'` (suspended admins are locked out).
4. **Auditability:** Every mutable action requires the admin's `id` and logs the action immediately to `public.admin_actions`.

## Technical Implementation

- **Location:** `apps/web/src/app/dashboard/admin`
- **Database:** Supabase indexes optimize read-heavy admin queries (`migration 013`).
- **Validation:** Zod schemas in `packages/core/src/validators/admin.ts`.
- **Service Layer:** `packages/api/src/admin/admin.service.ts` wraps all `admin.repository.ts` calls with a strict `resolveAdmin()` auth gate.

## Running Locally

Because admins have absolute power, you cannot sign up as an admin through the standard UI. To create an admin:
1. Sign up normally.
2. Open the Supabase dashboard (`npx supabase start` -> Studio).
3. Open the `profiles` table.
4. Change your user's `role` from `buyer` or `creator` to `admin`.
5. Ensure your `status` is `active`.
6. Reload the Rosovia dashboard — you will be redirected to the Admin Console.
