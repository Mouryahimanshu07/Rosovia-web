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

export default async function CreatorProfileNewPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  // Fetch existing profile check + categories in parallel
  const [existing, categories] = await Promise.all([
    getCurrentCreatorProfile(supabase),
    getActiveCategories(supabase),
  ]);

  // If already has a creator profile, redirect to edit
  if (existing) redirect('/dashboard/creator/profile/edit');

  return (
    <DashboardShell
      title="Create Your Creator Profile"
      description="Fill in your details to set up your public creator profile."
    >
      <div className="max-w-2xl">
        <CreatorProfileForm mode="create" categories={categories} />
      </div>
    </DashboardShell>
  );
}
