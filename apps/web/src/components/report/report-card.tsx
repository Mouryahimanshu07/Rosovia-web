import type { ReportWithDetails } from '@rosovia/core';
import { ReportStatusBadge } from './report-status-badge';

interface ReportCardProps {
  report: ReportWithDetails;
}

export function ReportCard({ report }: ReportCardProps) {
  const date = new Date(report.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900 capitalize">
            Reported {report.target_type}
          </p>
          <p className="text-xs text-gray-500 mt-1 capitalize">
            Reason: {report.reason.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ReportStatusBadge status={report.status} />
          <p className="text-xs text-gray-400">{date}</p>
        </div>
      </div>

      {report.description && (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
          <span className="block text-xs font-medium text-gray-500 mb-1">Your description:</span>
          {report.description}
        </div>
      )}

      {report.status !== 'pending' && report.admin_note && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-100">
          <span className="block text-xs font-medium text-blue-600 mb-1">Admin note:</span>
          {report.admin_note}
        </div>
      )}
    </div>
  );
}
