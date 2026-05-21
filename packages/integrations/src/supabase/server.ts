import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@rosovia/database';
export function createSupabaseServerClient(
  getCookie: (name: string) => string | undefined,
  setCookie: (name: string, value: string, options: CookieOptions) => void,
  removeCookie: (name: string, options: CookieOptions) => void
): any {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name);
        },
        set(name: string, value: string, options: CookieOptions) {
          setCookie(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          removeCookie(name, options);
        },
      },
    }
  );
}