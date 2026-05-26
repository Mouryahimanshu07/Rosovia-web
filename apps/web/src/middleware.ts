import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '~/lib/rate-limit';

/**
 * Middleware for route protection and rate limiting.
 *
 * - Enforces global IP-based rate-limiting on both api and dashboard pages.
 * - Refreshes the Supabase session cookie on dashboard routes.
 * - Redirects unauthenticated users away from /dashboard/* to /login.
 */
export async function middleware(request: NextRequest) {
  // 1. Resolve client IP for rate-limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

  // Apply a default limit of 100 requests per minute
  const limitResult = await rateLimit(ip, 100, 60000);

  if (!limitResult.success) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
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

  // Create default next response
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Attach rate-limiting headers to successful requests
  response.headers.set('X-RateLimit-Limit', String(limitResult.limit));
  response.headers.set('X-RateLimit-Remaining', String(limitResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(limitResult.reset));

  // 2. Suppress session/auth check on non-dashboard endpoints (e.g. public APIs, webhooks)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', options);
          },
        },
      }
    );

    // getUser verifies the JWT against the Supabase auth server — required for
    // server-side auth checks.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirected_from', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
