import { createSupabaseBrowserClient } from '@rosovia/integrations/browser';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

/**
 * Returns a singleton instance of the client-side Supabase client.
 * Safe to call from client components.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createSupabaseBrowserClient();
  }

  if (!clientInstance) {
    clientInstance = createSupabaseBrowserClient();
  }

  return clientInstance;
}
