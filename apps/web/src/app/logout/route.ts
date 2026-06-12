import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createWebServerClient } from '~/lib/supabase/server';

/**
 * Route Handler: /logout
 * Accepts GET and POST. Clears the session and redirects to /login.
 */
async function handleLogout(request: NextRequest) {
  const supabase = createWebServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/login', request.url));

  // Explicitly wipe out all Supabase-related cookies to prevent residual session problems
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  allCookies.forEach((c) => {
    if (c.name.startsWith('sb-') || c.name.toLowerCase().includes('supabase')) {
      response.cookies.set(c.name, '', {
        maxAge: -1,
        path: '/',
        expires: new Date(0),
        sameSite: 'lax',
        secure: true,
      });
    }
  });

  return response;
}

export { handleLogout as GET, handleLogout as POST };
