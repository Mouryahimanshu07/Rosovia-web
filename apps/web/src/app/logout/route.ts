import { NextResponse, type NextRequest } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';

/**
 * Route Handler: /logout
 * Accepts GET and POST. Clears the session and redirects to /login.
 *
 * FIX (RC-8): Removed the manual cookie deletion loop.
 * supabase.auth.signOut() via the SSR client already handles cookie clearing
 * with correct attributes (HttpOnly, Secure based on environment, SameSite, Path).
 * The previous manual deletion used `secure: true` unconditionally, which
 * breaks on localhost (browsers reject secure cookies on non-HTTPS origins),
 * leaving stale cookie fragments that confuse subsequent session checks.
 */
async function handleLogout(request: NextRequest) {
  const supabase = createWebServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', request.url));
}

export { handleLogout as GET, handleLogout as POST };
