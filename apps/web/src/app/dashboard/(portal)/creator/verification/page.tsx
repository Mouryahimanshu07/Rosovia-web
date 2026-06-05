import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorVerificationDashboardState } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { VerificationStatusCard } from '~/components/verification/verification-status-card';
import { VerificationRequestCard } from '~/components/verification/verification-request-card';
import { VerificationRequestForm } from './verification-request-form';
import type { VerificationLevel } from '@rosovia/core';

export const metadata: Metadata = {
  title: 'Verification — Creator Dashboard — Rosovia',
  description: 'Request verification for your Rosovia creator profile.',
};

export default async function CreatorVerificationPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const { creatorProfile, pendingRequests, latestRequest, allRequests } =
    await getCurrentCreatorVerificationDashboardState(supabase);

  if (!creatorProfile) {
    return (
      <DashboardShell
        title="Verification"
        description="Request verification for your creator profile."
      >
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center max-w-lg">
          <div className="text-3xl mb-3" aria-hidden="true">🎨</div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Create your creator profile first
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            You need a creator profile before you can request verification.
          </p>
          <Link
            href="/dashboard/creator/profile/new"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
          >
            Create creator profile
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const pendingTypes = pendingRequests.map((r) => r.verification_type);
  const hasPendingRequest = pendingRequests.length > 0;

  // Past requests: show all except latest (which StatusCard already shows)
  const pastRequests = allRequests.slice(1);

  return (
    <DashboardShell
      title="Verification"
      description="Build buyer trust by getting your creator profile verified."
    >
      <div className="max-w-2xl space-y-6">
        {/* Current verification status */}
        <VerificationStatusCard
          verificationLevel={creatorProfile.verification_level as VerificationLevel}
          isVerified={creatorProfile.is_verified}
          hasPendingRequest={hasPendingRequest}
          latestRequestStatus={latestRequest?.status ?? null}
          latestRequestType={latestRequest?.verification_type ?? null}
          latestAdminNote={latestRequest?.admin_note ?? null}
        />

        {/* Submit new request form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Submit a Verification Request
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Upload a private document to verify your identity or business. Your document is stored
            securely and is never shared publicly.
          </p>
          <VerificationRequestForm pendingTypes={pendingTypes} />
        </div>

        {/* Previous requests */}
        {pastRequests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Previous Requests</h3>
            {pastRequests.map((req) => (
              <VerificationRequestCard key={req.id} request={req} showAdminDetails={false} />
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">About Verification</p>
          <p>Verification requests are reviewed by the Rosovia team within 1–3 business days.</p>
          <p>Documents are stored privately and are never accessible to buyers or the public.</p>
          <p>
            You can view your public profile at{' '}
            <a
              href={`/creators/${creatorProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              /creators/{creatorProfile.slug}
            </a>
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
