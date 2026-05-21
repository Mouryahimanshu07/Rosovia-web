import type { ReportWithDetails } from '@rosovia/core';
import { ReportStatusBadge } from './report-status-badge';

interface AdminReportCardProps {
  report: ReportWithDetails;
}

export function AdminReportCard({ report }: AdminReportCardProps) {
  const createdAt = new Date(report.created_at).toLocaleString('en-IN');
  const reviewedAt = report.reviewed_at ? new Date(report.reviewed_at).toLocaleString('en-IN') : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900 capitalize">
              {report.target_type} Report
            </span>
            <ReportStatusBadge status={report.status} />
          </div>
          <p className="text-xs text-gray-500">
            Target ID: <code className="bg-gray-100 px-1 rounded">{report.target_id}</code>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-gray-700">
            Reporter: {report.reporter_display_name ?? report.reporter_id}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{createdAt}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Reason</p>
          <p className="text-sm text-gray-900 capitalize">{report.reason.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {report.description && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Reporter Details</p>
          <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            {report.description}
          </div>
        </div>
      )}

      {report.status !== 'pending' && (
        <div className="rounded-md bg-blue-50/50 p-3 border border-blue-100">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Review Details</p>
            <p className="text-xs text-blue-600">
              By {report.reviewed_by_name ?? report.reviewed_by} on {reviewedAt}
            </p>
          </div>
          {report.admin_note ? (
            <p className="text-sm text-gray-700">{report.admin_note}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">No note provided.</p>
          )}
        </div>
      )}
    </div>
  );
}
