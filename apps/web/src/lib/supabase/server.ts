import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@rosovia/integrations';

/**
 * Next.js App Router specific Supabase server client.
 * Uses next/headers cookies — safe for Server Components, Server Actions, Route Handlers.
 * Never exposes service role key.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function createWebServerClient(): SupabaseClient {
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
}
