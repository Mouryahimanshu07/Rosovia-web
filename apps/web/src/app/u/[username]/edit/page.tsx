import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
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
    description: `Update your Rosovia creator profile settings for @${params.username}.`,
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

  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  if (!profile.username || profile.username !== params.username) {
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
    <div className="min-h-screen bg-gray-50/60">
      {/* ── Top Nav Bar ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/u/${profile.username}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Profile</span>
            </Link>
            <span className="text-gray-200 font-light">|</span>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-800">Edit Profile</span>
            </div>
          </div>

          {/* Avatar preview */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-indigo-50 relative flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name || profile.username || ''}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-black text-indigo-400">
                  {(profile.full_name || profile.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-gray-900 leading-none">{profile.full_name || profile.username}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5 capitalize">{profile.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page intro */}
        <div className="mb-6 text-center sm:text-left">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Edit Your Profile
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-medium">
            Changes are visible to everyone on your public profile immediately after saving.
          </p>
        </div>

        {/* Form Card */}
        <ProfileForm
          profile={profile}
          creatorProfile={creatorProfile}
          categories={categories}
        />
      </main>
    </div>
  );
}
