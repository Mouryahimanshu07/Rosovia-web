import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { getCurrentCreatorProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { CreatorProfileForm } from '~/components/forms/creator-profile-form';
import { ProfileImageUpload } from '~/components/media/profile-image-upload';
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

  const existingProfile = await getCurrentCreatorProfile(supabase);
  if (!existingProfile) redirect('/dashboard/creator/profile/new');

  const categories = await getActiveCategories(supabase);

  return (
    <DashboardShell
      title="Edit Creator Profile"
      description="Update your public creator profile."
    >
      <div className="max-w-2xl space-y-8">
        {/* Profile image upload */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Profile Image</h2>
          <ProfileImageUpload currentUrl={existingProfile.profile_image_url ?? null} />
        </div>

        {/* Profile details form */}
        <CreatorProfileForm mode="edit" categories={categories} existingProfile={existingProfile} />
      </div>
    </DashboardShell>
  );
}
