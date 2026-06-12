import { redirect } from 'next/navigation';
import { getServerProfile } from '~/lib/supabase/server';
import { getDashboardRedirectPath } from '@rosovia/api';

export const dynamic = 'force-dynamic';

/**
 * /dashboard — Entry point that redirects to the correct role-based dashboard.
 * Creator  → /dashboard/creator
 * Buyer    → /dashboard/buyer
 * Admin    → /dashboard/admin
 */
export default async function DashboardEntryPage() {
  const profile = await getServerProfile();

  if (!profile) redirect('/login');

  redirect(getDashboardRedirectPath(profile.role));
}
