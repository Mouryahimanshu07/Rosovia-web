import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { getCreatorProfileDashboardState } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { VerificationBadge } from '~/components/creator/verification-badge';
import { VerificationLevelBadge } from '~/components/verification/verification-level-badge';
import { RatingSummary } from '~/components/creator/rating-summary';

export default async function CreatorProfileDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const { creatorProfile } = await getCreatorProfileDashboardState(supabase);

  if (!creatorProfile) {
    return (
      <DashboardShell title="Creator Profile" description="Set up your public creator profile to start attracting buyers.">
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-2xl">
            🎨
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Create your creator profile</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your public creator profile lets buyers discover you, see your skills, and contact you for work.
          </p>
          <Link
            href="/dashboard/creator/profile/new"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition"
          >
            Get started
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Creator Profile"
      description="Your public profile is live. Edit it anytime."
    >
      <div className="max-w-2xl space-y-6">
        {/* Profile header */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
            {creatorProfile.profile_image_url ? (
              <Image src={creatorProfile.profile_image_url} alt={creatorProfile.display_name} fill sizes="64px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-semibold">
                {creatorProfile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">{creatorProfile.display_name}</h2>
              <VerificationBadge level={creatorProfile.verification_level} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              /creators/{creatorProfile.slug}
            </p>
            <div className="mt-2">
              <RatingSummary avg={creatorProfile.rating_avg} count={creatorProfile.rating_count} />
            </div>
          </div>
        </div>

        {/* Bio */}
        {creatorProfile.bio && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bio</h3>
            <p className="text-sm text-gray-600">{creatorProfile.bio}</p>
          </div>
        )}

        {/* Skills / Languages / Location */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700 mb-1">Skills</p>
            <p className="text-gray-500">{creatorProfile.skills.length > 0 ? creatorProfile.skills.join(', ') : '—'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Languages</p>
            <p className="text-gray-500">{creatorProfile.languages.length > 0 ? creatorProfile.languages.join(', ') : '—'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Location</p>
            <p className="text-gray-500">
              {[creatorProfile.city, creatorProfile.state, creatorProfile.country].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        {/* Verification status + CTA */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Verification Status</h3>
            <VerificationLevelBadge
              level={creatorProfile.verification_level}
              showUnverified={true}
            />
          </div>
          <Link
            href="/dashboard/creator/verification"
            className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition"
          >
            {creatorProfile.is_verified ? 'View verification' : 'Request Verification'}
          </Link>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/dashboard/creator/profile/edit"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Edit profile
          </Link>
          <Link
            href={`/creators/${creatorProfile.slug}`}
            target="_blank"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            View public profile ↗
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
