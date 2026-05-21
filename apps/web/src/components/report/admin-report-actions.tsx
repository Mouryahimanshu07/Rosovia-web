'use client';

import { useState } from 'react';
import type { ReportWithDetails, ReportModerationAction } from '@rosovia/core';
import { moderateReportAction } from '~/app/dashboard/admin/reports/actions';
import { Button } from '@rosovia/ui';

interface AdminReportActionsProps {
  report: ReportWithDetails;
}

export function AdminReportActions({ report }: AdminReportActionsProps) {
  const [adminNote, setAdminNote] = useState('');
  const [loadingAction, setLoadingAction] = useState<ReportModerationAction | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isResolvedOrRejected = report.status === 'resolved' || report.status === 'rejected';

  // Available actions depend on target type and current status
  const availableActions: { label: string; action: ReportModerationAction; variant: 'default' | 'outline' | 'ghost', className?: string }[] = [];

  if (report.status === 'pending') {
    availableActions.push({ label: 'Mark Reviewed', action: 'mark_reviewed', variant: 'outline' });
  }

  if (!isResolvedOrRejected) {
    availableActions.push({ label: 'Resolve (Valid)', action: 'resolve', variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' });
    availableActions.push({ label: 'Reject (Invalid)', action: 'reject', variant: 'outline' });

    if (report.target_type === 'review') {
      availableActions.push({ label: 'Hide Review', action: 'hide_review', variant: 'outline', className: 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700' });
    }
    if (report.target_type === 'listing') {
      availableActions.push({ label: 'Suspend Listing', action: 'suspend_listing', variant: 'outline', className: 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700' });
    }
    if (report.target_type === 'user') {
      availableActions.push({ label: 'Suspend User', action: 'suspend_user', variant: 'outline', className: 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700' });
    }
  }

  const handleAction = async (action: ReportModerationAction) => {
    // Basic confirmation for destructive actions
    if (['hide_review', 'suspend_listing', 'suspend_user'].includes(action)) {
      if (!window.confirm(`Are you sure you want to execute: ${action}? This will affect live content.`)) {
        return;
      }
    }

    setServerError(null);
    setLoadingAction(action);

    const result = await moderateReportAction({
      reportId: report.id,
      action,
      adminNote: adminNote.trim() || undefined,
    });

    if (!result.success) {
      setServerError(result.error);
    } else {
      setAdminNote(''); // Clear note on success
    }

    setLoadingAction(null);
  };

  if (isResolvedOrRejected) {
    return (
      <div className="text-sm text-gray-500 italic">
        This report has been {report.status}. No further moderation actions can be taken directly on it.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor={`admin-note-${report.id}`} className="block text-xs font-medium text-gray-700 mb-1">
          Admin Note (recorded with action)
        </label>
        <textarea
          id={`admin-note-${report.id}`}
          placeholder="Optional reasoning for this moderation action..."
          value={adminNote}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdminNote(e.target.value)}
          rows={2}
          className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {availableActions.map(({ label, action, variant, className }) => (
          <Button
            key={action}
            variant={variant}
            size="sm"
            onClick={() => handleAction(action)}
            disabled={loadingAction !== null}
            className={className}
          >
            {loadingAction === action ? 'Processing...' : label}
          </Button>
        ))}
      </div>
    </div>
  );
}
