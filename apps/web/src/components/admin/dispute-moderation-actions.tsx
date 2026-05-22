'use client';

import { useState } from 'react';
import { moderateDisputeAction } from '~/app/dashboard/admin/disputes/actions';
import { AdminActionButton } from './admin-action-button';

interface DisputeModerationActionsProps {
  disputeId: string;
  currentStatus: string;
}

export function DisputeModerationActions({ disputeId, currentStatus }: DisputeModerationActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<'resolve' | 'reject' | null>(null);

  const act = async (action: 'under_review' | 'resolve' | 'reject') => {
    setError(null);
    const result = await moderateDisputeAction({ disputeId, action, note: note || undefined });
    if (result.success) {
      const statusMap = { under_review: 'under_review', resolve: 'resolved', reject: 'rejected' };
      setStatus(statusMap[action]);
      setShowNoteInput(false);
      setPendingAction(null);
      setNote('');
    } else {
      setError(result.error);
    }
  };

  if (status === 'resolved' || status === 'rejected') {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      
      {!showNoteInput ? (
        <div className="flex flex-wrap gap-2">
          {status === 'open' && (
            <AdminActionButton
              label="Review"
              onConfirm={() => act('under_review')}
              confirmMessage="Move this dispute to 'under_review' status?"
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            />
          )}
          <button
            onClick={() => {
              setPendingAction('resolve');
              setShowNoteInput(true);
            }}
            className="inline-flex items-center rounded-md border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm hover:bg-green-50 transition"
          >
            Resolve
          </button>
          <button
            onClick={() => {
              setPendingAction('reject');
              setShowNoteInput(true);
            }}
            className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 transition"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-xs font-medium text-gray-700 capitalize">
            {pendingAction} Dispute Resolution Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Provide a reason or note for this decision..."
            className="w-full text-xs border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowNoteInput(false);
                setPendingAction(null);
                setNote('');
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => act(pendingAction!)}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition font-semibold"
            >
              Submit Decision
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
