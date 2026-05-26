import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorListingDashboardState, listCollectionsForCreatorDashboard } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { CollectionsDashboardClient } from './collections-dashboard-client';

export default async function CreatorCollectionsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const { creatorProfile, listings } = await getCurrentCreatorListingDashboardState(supabase);

  if (!creatorProfile) {
    redirect('/dashboard/creator/profile');
  }

  // Get current collections
  const collections = await listCollectionsForCreatorDashboard(supabase);

  // We only want to show listings that are approved/active to add to collections
  const activeListings = listings.filter(l => l.status === 'approved' && !l.deleted_at);

  return (
    <DashboardShell
      title="Featured Collections"
      description="Organize your best listings and portfolio pieces into themed showcases on your public profile."
    >
      <CollectionsDashboardClient
        initialCollections={collections}
        listings={activeListings}
      />
    </DashboardShell>
  );
}
