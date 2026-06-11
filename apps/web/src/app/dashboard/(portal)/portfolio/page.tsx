import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile, listCreatorPortfolioMedia } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { PortfolioList } from './portfolio-list';

export default async function PortfolioDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const creatorProfile = await getCurrentCreatorProfile(supabase);
  if (!creatorProfile) {
    redirect('/dashboard/creator/profile');
  }

  const portfolioItems = await listCreatorPortfolioMedia(supabase, profile.id);

  return (
    <DashboardShell
      title="My Portfolio"
      description="Manage the showcase gallery on your public profile page."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-950">Gallery Items ({portfolioItems.length})</h2>
          <Link
            href="/dashboard/portfolio/new"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition shadow-sm"
          >
            + Add Portfolio Item
          </Link>
        </div>

        <PortfolioList initialItems={portfolioItems} />
      </div>
    </DashboardShell>
  );
}
