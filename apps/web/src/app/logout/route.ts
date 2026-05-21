import { NextResponse, type NextRequest } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';

/**
 * Route Handler: /logout
 * Accepts GET and POST. Clears the session and redirects to /login.
 */
async function handleLogout(request: NextRequest) {
  const supabase = createWebServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url));
}

export { handleLogout as GET, handleLogout as POST };
