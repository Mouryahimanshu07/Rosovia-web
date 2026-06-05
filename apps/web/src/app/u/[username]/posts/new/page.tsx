import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { NewCreatorPostPageClient } from './NewCreatorPostPageClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Create New Post (@${params.username}) — Rosovia`,
  };
}

export default async function NewPostPage({ params }: Props) {
  const supabase = createWebServerClient();

  // Auth check
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Ownership check — only the creator can manage their own posts
  if (!profile.username || profile.username !== params.username) {
    if (profile.username) redirect(`/u/${profile.username}/posts/new`);
    notFound();
  }

  // Only creators can have posts
  if (profile.role !== 'creator') redirect(`/u/${profile.username}`);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <NewCreatorPostPageClient username={params.username} />
    </main>
  );
}
