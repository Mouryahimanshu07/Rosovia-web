import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listVerificationRequestsForAdmin } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { VerificationRequestCard } from '~/components/verification/verification-request-card';
import { VerificationReviewActions } from '~/components/verification/verification-review-actions';

export const metadata: Metadata = {
  title: 'Verification Review — Admin — Rosovia',
  description: 'Review creator verification requests on Rosovia.',
};

export default async function AdminVerificationPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const [pendingRequests, recentRequests] = await Promise.all([
    listVerificationRequestsForAdmin(supabase, { status: 'pending' }),
    listVerificationRequestsForAdmin(supabase, {}),
  ]);

  // Recent = all requests; dedupe with pending already shown
  const nonPendingRecent = recentRequests.filter((r) => r.status !== 'pending').slice(0, 10);

  return (
    <DashboardShell
      title="Verification Review"
      description="Review and approve or reject creator verification requests."
    >
      <div className="max-w-3xl space-y-8">
        {/* Pending requests */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Pending Requests{' '}
              {pendingRequests.length > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                  {pendingRequests.length}
                </span>
              )}
            </h2>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-2xl mb-2" aria-hidden="true">✅</p>
              <p className="text-sm font-medium text-gray-700">All caught up!</p>
              <p className="text-xs text-gray-500 mt-1">No pending verification requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
                  <div className="p-5">
                    <VerificationRequestCard request={req} showAdminDetails={true} />
                  </div>
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <VerificationReviewActions request={req} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently reviewed */}
        {nonPendingRecent.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Recently Reviewed</h2>
            <div className="space-y-3">
              {nonPendingRecent.map((req) => (
                <VerificationRequestCard key={req.id} request={req} showAdminDetails={true} />
              ))}
            </div>
          </section>
        )}

        {/* Security notice */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">Security Notice</p>
          <p>Verification documents are stored privately in R2. No download links are available here.</p>
          <p>Document metadata (filename, type, size, upload date) is displayed for reference only.</p>
          <p>Full document access requires direct R2 access — this is intentional and secure.</p>
        </div>
      </div>
    </DashboardShell>
  );
}
