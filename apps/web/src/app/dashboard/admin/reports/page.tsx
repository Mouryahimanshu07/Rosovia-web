import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listReportsForAdmin } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { AdminReportCard } from '~/components/report/admin-report-card';
import { AdminReportActions } from '~/components/report/admin-report-actions';
import type { ReportStatus, ReportTargetType } from '@rosovia/core';

export const metadata: Metadata = {
  title: 'Reports & Moderation — Admin — Rosovia',
  description: 'Review and moderate reports submitted by users.',
};

interface Props {
  searchParams: {
    status?: ReportStatus;
    targetType?: ReportTargetType;
  };
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const reports = await listReportsForAdmin(supabase, {
    status: searchParams.status,
    targetType: searchParams.targetType,
  });

  return (
    <DashboardShell
      title="Reports & Moderation"
      description="Review user-submitted reports and take moderation actions."
    >
      <div className="max-w-4xl space-y-6">
        
        {/* Simple Filters via URL (Links) */}
        <div className="flex flex-wrap gap-2 mb-6">
          <a
            href="/dashboard/admin/reports"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${!searchParams.status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All Reports
          </a>
          <a
            href="/dashboard/admin/reports?status=pending"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${searchParams.status === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Pending
          </a>
          <a
            href="/dashboard/admin/reports?status=reviewed"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${searchParams.status === 'reviewed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Reviewed
          </a>
          <a
            href="/dashboard/admin/reports?status=resolved"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${searchParams.status === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Resolved
          </a>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-2xl mb-2" aria-hidden="true">✅</p>
            <p className="text-sm font-medium text-gray-700">No reports found</p>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <AdminReportCard report={report} />
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <AdminReportActions report={report} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
