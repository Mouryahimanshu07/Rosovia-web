import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile } from '@rosovia/api';
import type { DbCategory } from '@rosovia/core';
import { ProfileForm } from '~/components/forms/profile-form';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Edit Profile (@${params.username}) — Rosovia`,
  };
}

async function getActiveCategories(
  supabase: ReturnType<typeof createWebServerClient>
): Promise<DbCategory[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  return (data ?? []) as DbCategory[];
}

export default async function EditProfilePage({ params }: Props) {
  const supabase = createWebServerClient();

  // Auth check
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Ownership check — only the profile owner can edit their own profile
  if (!profile.username || profile.username !== params.username) {
    // If logged in but trying to edit someone else's profile, redirect to own edit page
    if (profile.username) {
      redirect(`/u/${profile.username}/edit`);
    }
    notFound();
  }

  let creatorProfile = null;
  let categories: DbCategory[] = [];

  if (profile.role === 'creator') {
    const [fetchedCreator, fetchedCategories] = await Promise.all([
      getCurrentCreatorProfile(supabase),
      getActiveCategories(supabase),
    ]);
    creatorProfile = fetchedCreator;
    categories = fetchedCategories;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <a
            href={`/u/${profile.username}`}
            className="text-sm text-gray-500 hover:text-indigo-600 transition-colors font-medium"
          >
            ← Back to Profile
          </a>
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-2">Edit Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update your public identity, portfolio information, and creator details.
        </p>
      </div>

      {/* Edit Form Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-sm">
        <ProfileForm
          profile={profile}
          creatorProfile={creatorProfile}
          categories={categories}
        />
      </div>
    </main>
  );
}
