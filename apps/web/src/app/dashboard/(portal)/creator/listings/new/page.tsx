import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ListingForm } from '~/components/forms/listing-form';
import type { DbCategory } from '@rosovia/core';

async function getActiveCategories(supabase: ReturnType<typeof createWebServerClient>): Promise<DbCategory[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  return (data ?? []) as DbCategory[];
}

export default async function CreatorListingNewPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  // Fetch creator profile + categories in parallel
  const [creatorProfile, categories] = await Promise.all([
    getCurrentCreatorProfile(supabase),
    getActiveCategories(supabase),
  ]);

  if (!creatorProfile) redirect('/dashboard/creator/profile/new');

  return (
    <DashboardShell
      title="Create Listing"
      description="Add a new product, service, or offering to your profile."
    >
      <div className="max-w-2xl">
        <ListingForm mode="create" categories={categories} />
      </div>
    </DashboardShell>
  );
}
