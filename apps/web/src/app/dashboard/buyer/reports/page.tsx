import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCurrentUserReportsService } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ReportCard } from '~/components/report/report-card';

export const metadata: Metadata = {
  title: 'My Reports — Rosovia',
  description: 'View the status of reports you have submitted.',
};

export default async function BuyerReportsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Currently we render this inside the buyer dashboard layout, but active creators
  // can also report things. If they navigate here, they'll see their reports.
  
  const reports = await listCurrentUserReportsService(supabase);

  return (
    <DashboardShell
      title="My Reports"
      description="Track the status of reports you have submitted to Rosovia moderation."
    >
      <div className="max-w-3xl space-y-6">
        {reports.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">No reports submitted</p>
            <p className="text-xs text-gray-500 mt-1">
              You haven&apos;t reported any content on Rosovia yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
