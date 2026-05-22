import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { getCurrentCreatorProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { CreatorProfileForm } from '~/components/forms/creator-profile-form';
import type { DbCategory } from '@rosovia/core';

async function getActiveCategories(supabase: ReturnType<typeof createWebServerClient>): Promise<DbCategory[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  return (data ?? []) as DbCategory[];
}

export default async function CreatorProfileEditPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  // Fetch profile + categories in parallel — saves ~1 network round-trip
  const [existingProfile, categories] = await Promise.all([
    getCurrentCreatorProfile(supabase),
    getActiveCategories(supabase),
  ]);

  if (!existingProfile) redirect('/dashboard/creator/profile/new');

  return (
    <DashboardShell
      title="Edit Creator Profile"
      description="Update your public creator profile."
    >
      <div className="max-w-2xl space-y-8">
        {/* Profile details form */}
        <CreatorProfileForm mode="edit" categories={categories} existingProfile={existingProfile} />
      </div>
    </DashboardShell>
  );
}
