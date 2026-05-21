import { NextResponse, type NextRequest } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';
import { ensureUserProfile, getDashboardRedirectPath } from '@rosovia/api';

/**
 * Route Handler: /auth/callback
 *
 * Handles Supabase auth code exchange (PKCE flow).
 * - Exchanges the code for a session.
 * - Ensures the profile row exists.
 * - Redirects based on role or redirect_to param.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect_to');

  if (code) {
    const supabase = createWebServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle password reset redirect
      if (redirectTo === '/reset-password') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      const profile = await ensureUserProfile(supabase);

      if (!profile) {
        return NextResponse.redirect(`${origin}/select-role`);
      }

      if (profile.status === 'suspended' || profile.status === 'deleted') {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=account_${profile.status}`);
      }

      const dashboardPath = getDashboardRedirectPath(profile.role);
      return NextResponse.redirect(`${origin}${dashboardPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
