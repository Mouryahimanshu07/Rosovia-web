import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Clock, CheckCircle2, XCircle, EyeOff, LayoutGrid } from 'lucide-react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCreatorOwnPosts } from '@rosovia/api';
import { CreatorPostGrid } from '~/components/post/CreatorPostGrid';
import type { CreatorPostWithDetails } from '@rosovia/core';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `My Posts (@${params.username}) — Rosovia`,
  };
}

export default async function UserPostsPage({ params }: Props) {
  const supabase = createWebServerClient();

  // Auth check
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Ownership check — only the creator can manage their own posts
  if (!profile.username || profile.username !== params.username) {
    if (profile.username) redirect(`/u/${profile.username}/posts`);
    notFound();
  }

  // Only creators can have posts
  if (profile.role !== 'creator') redirect(`/u/${profile.username}`);

  const { data: posts } = await listCreatorOwnPosts(supabase);

  // Compute stats
  const approved = posts.filter((p: CreatorPostWithDetails) => p.moderation_status === 'approved').length;
  const pending = posts.filter((p: CreatorPostWithDetails) => p.moderation_status === 'pending').length;
  const rejected = posts.filter((p: CreatorPostWithDetails) => p.moderation_status === 'rejected').length;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <a
            href={`/u/${profile.username}`}
            className="text-sm text-gray-500 hover:text-indigo-600 transition-colors font-medium"
          >
            ← Back to Profile
          </a>
          <h1 className="text-2xl font-black text-gray-900 mt-2 tracking-tight">Work Posts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Share your work — posts go live after a quick review.
          </p>
        </div>
        <Link
          href={`/u/${params.username}/posts/new`}
          id="create-post-btn"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700 shadow-sm transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Post
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Live', count: approved, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Pending Review', count: pending, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Rejected', count: rejected, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
        ].map(({ label, count, color, bg, border }) => (
          <div key={label} className={`rounded-2xl ${bg} p-4 text-center border ${border}`}>
            <p className={`text-2xl font-black ${color}`}>{count}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Moderation info banner */}
      {pending > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Clock className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">
              {pending} post{pending > 1 ? 's are' : ' is'} pending review.
            </span>{' '}
            pending review normally takes admin approval. Posts are typically reviewed within 24 hours.
          </div>
        </div>
      )}

      {rejected > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <span className="font-semibold">
              {rejected} post{rejected > 1 ? 's have' : ' has'} been rejected.
            </span>{' '}
            rejected item can be edited and resubmitted.
          </div>
        </div>
      )}

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-5 rounded-2xl border border-dashed border-gray-200 bg-white">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-indigo-300" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">No posts yet</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              Share your first work post to attract buyers and build your portfolio.
            </p>
          </div>
          <Link
            href={`/u/${params.username}/posts/new`}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            Create your first post
          </Link>
        </div>
      ) : (
        <CreatorPostGrid posts={posts} showCreator={false} isOwnDashboard={true} />
      )}
    </main>
  );
}
