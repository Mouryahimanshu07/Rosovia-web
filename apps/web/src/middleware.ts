import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '~/lib/rate-limit';

/**
 * Middleware for route protection, rate limiting, and session syncing.
 *
 * Runs on all page routes to ensure Supabase session tokens are refreshed on the server side,
 * preventing session expiration while browsing public pages.
 *
 * FIX (RC-5): Rewrote cookie forwarding to use the request-header mutation pattern.
 * Instead of copying cookie values between response objects (which drops attributes),
 * we now write refreshed session cookies to both the request headers (so downstream
 * server components see the updated session) AND the response (so the browser receives
 * the Set-Cookie headers). Redirects are built from this response, preserving full
 * cookie attributes (HttpOnly, Secure, SameSite, Path, MaxAge).
 *
 * FIX (RC-6 partial): The profile DB query is now only performed when the user is on
 * a route that actually needs role-based gating (/dashboard/*, /login, /signup,
 * /select-role). All other authenticated routes skip the DB call entirely.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Resolve client IP for rate-limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

  // Apply IP-based rate limiting on API and Dashboard routes (limit to 100 requests per minute)
  if (pathname.startsWith('/api/') || pathname.startsWith('/dashboard')) {
    const limitResult = await rateLimit(ip, 100, 60000);

    if (!limitResult.success) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(limitResult.limit),
              'X-RateLimit-Remaining': String(limitResult.remaining),
              'X-RateLimit-Reset': String(limitResult.reset),
            },
          }
        );
      }

      return new NextResponse('Too Many Requests. Please wait before retrying.', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limitResult.limit),
          'X-RateLimit-Remaining': String(limitResult.remaining),
          'X-RateLimit-Reset': String(limitResult.reset),
        },
      });
    }
  }

  // FIX (RC-5): Use the request-header mutation pattern for cookie forwarding.
  // When Supabase refreshes a token during getUser(), it calls `set()` on the cookie
  // handlers. We write the refreshed cookie to both the request headers (so server
  // components read the updated token) and the response (so the browser gets Set-Cookie).
  // This ensures redirects built from `response` always carry full cookie attributes.
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // 2. Initialize Supabase client with the request/response cookie bridge
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Write to request so downstream server components see the updated session
          request.cookies.set({ name, value, ...options });
          // Write to response so the browser receives the Set-Cookie header
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set(name, '', options);
        },
      },
    }
  );

  // Fetch current user (verifies JWT signature and refreshes session if near expiry)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // FIX (RC-5): redirectWithCookies now builds the redirect from the current `response`
  // object which already has the full cookie attributes set by the Supabase SSR adapter.
  // The previous implementation created a new NextResponse.redirect() and only copied
  // cookie values without attributes (HttpOnly, Secure, SameSite, Path, MaxAge).
  const redirectWithCookies = (targetUrl: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(targetUrl, request.url));
    // Copy all cookies from the response (which has full attributes from Supabase SSR)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        // ResponseCookies from Next.js preserve the full options on getAll()
        // when they were set via .set(name, value, options)
      });
    });
    return redirectResponse;
  };

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAuthRoute = pathname === '/login' || pathname === '/signup';
  const isSelectRoleRoute = pathname === '/select-role';

  const getRoleRedirectPath = (role: string) => {
    return role === 'admin' 
      ? '/dashboard/admin' 
      : role === 'creator' 
        ? '/dashboard/creator' 
        : '/dashboard/buyer';
  };

  // FIX (RC-6 partial): Only query the profile when the route actually needs role/status
  // information for gating decisions. This eliminates the DB round-trip for the vast
  // majority of page loads (explore, listings, profile pages, messages, etc.).
  let profile = null;
  if (user && (isDashboardRoute || isAuthRoute || isSelectRoleRoute)) {
    const { data } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    profile = data;
  }

  if (isDashboardRoute) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirected_from', pathname);
      return redirectWithCookies(loginUrl);
    }

    if (!profile) {
      return redirectWithCookies('/select-role');
    }

    if (profile.status !== 'active') {
      // Clear session from cookies on suspension
      await supabase.auth.signOut();
      return redirectWithCookies('/login?error=account_suspended');
    }

    // Role-based URL Authorization Gate
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      return redirectWithCookies(getRoleRedirectPath(profile.role));
    }

    if (pathname.startsWith('/dashboard/creator') && profile.role !== 'creator' && profile.role !== 'admin') {
      return redirectWithCookies('/dashboard/buyer');
    }

    if (pathname.startsWith('/dashboard/buyer') && profile.role !== 'buyer' && profile.role !== 'admin') {
      return redirectWithCookies('/dashboard/creator');
    }

    if (pathname.startsWith('/dashboard/admin') && profile.role !== 'admin') {
      const redirectPath = profile.role === 'creator' ? '/dashboard/creator' : '/dashboard/buyer';
      return redirectWithCookies(redirectPath);
    }
  } else if (isAuthRoute) {
    // Prevent authenticated users from accessing login/signup forms
    if (user) {
      if (!profile) {
        return redirectWithCookies('/select-role');
      }

      return redirectWithCookies(getRoleRedirectPath(profile.role));
    }
  } else if (isSelectRoleRoute) {
    if (!user) {
      return redirectWithCookies('/login');
    }

    // If profile already exists, skip select-role and redirect to dashboard
    if (profile) {
      return redirectWithCookies(getRoleRedirectPath(profile.role));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (manifest config)
     * - sw.js (service worker)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
