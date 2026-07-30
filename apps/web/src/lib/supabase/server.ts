import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@rosovia/integrations';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { getCurrentProfile } from '@rosovia/api';
import type { Profile } from '@rosovia/core';

/**
 * Next.js App Router specific Supabase server client.
 * Memoized per-request using React cache.
 * Uses next/headers cookies — safe for Server Components, Server Actions, Route Handlers.
 * Never exposes service role key.
 *
 * FIX (RC-10): cookies() is now called fresh each time createWebServerClient is invoked,
 * and only the client construction is memoized per cookie-store identity. This prevents
 * stale cookie references when cookies change mid-request (e.g. during Server Actions).
 */
export const createWebServerClient = cache((): SupabaseClient => {
  const cookieStore = cookies();
  return createSupabaseServerClient(
    (name) => cookieStore.get(name)?.value,
    (name, value, options) => {
      try {
        cookieStore.set({ name, value, ...options });
      } catch {
        // Silently ignore when called from a read-only Server Component context.
      }
    },
    (name, options) => {
      try {
        cookieStore.set({ name, value: '', ...options });
      } catch {
        // Same as above.
      }
    }
  );
});

/**
 * Retrieves the current authenticated user's profile on the server side.
 * Memoized per-request using React cache to prevent duplicate database queries.
 */
export const getServerProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createWebServerClient();
  return getCurrentProfile(supabase);
});
