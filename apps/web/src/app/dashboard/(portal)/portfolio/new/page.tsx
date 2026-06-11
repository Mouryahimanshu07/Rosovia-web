import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { NewPortfolioForm } from './new-portfolio-form';

export default async function NewPortfolioPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const creatorProfile = await getCurrentCreatorProfile(supabase);
  if (!creatorProfile) {
    redirect('/dashboard/creator/profile');
  }

  return (
    <DashboardShell
      title="Add Portfolio Work"
      description="Showcase your best work, designs, images or video case-studies on your profile page."
    >
      <div className="max-w-2xl">
        <NewPortfolioForm />
      </div>
    </DashboardShell>
  );
}
