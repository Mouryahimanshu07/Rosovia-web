import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getDashboardRedirectPath } from '@rosovia/api';

export const dynamic = 'force-dynamic';

/**
 * /dashboard — Entry point that redirects to the correct role-based dashboard.
 * Creator  → /dashboard/creator
 * Buyer    → /dashboard/buyer
 * Admin    → /dashboard/admin
 */
export default async function DashboardEntryPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');

  redirect(getDashboardRedirectPath(profile.role));
}
