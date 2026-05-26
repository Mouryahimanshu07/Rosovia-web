// apps/web/src/app/dashboard/buyer/saved/page.tsx

import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getCurrentProfile,
  listSavedListingsForUser,
  listSavedCreatorsForUser,
} from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { SavedDashboardClient } from './saved-dashboard-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved Items — Rosovia',
  description: 'Your curated list of bookmarked listings and saved creators.',
};

export default async function SavedItemsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Fetch saved items in parallel
  const [savedListings, savedCreators] = await Promise.all([
    listSavedListingsForUser(supabase),
    listSavedCreatorsForUser(supabase),
  ]);

  return (
    <DashboardShell
      title="Saved Items"
      description="Quickly access and organize your saved listings and creators."
    >
      <SavedDashboardClient
        initialListings={savedListings}
        initialCreators={savedCreators}
      />
    </DashboardShell>
  );
}
