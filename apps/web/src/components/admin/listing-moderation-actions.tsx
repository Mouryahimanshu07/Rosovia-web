'use client';

import { useState } from 'react';
import { moderateListingAction } from '~/app/dashboard/admin/listings/actions';
import { AdminActionButton } from './admin-action-button';

interface ListingModerationActionsProps {
  listingId: string;
  currentStatus: string;
}

export function ListingModerationActions({ listingId, currentStatus }: ListingModerationActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);

  const act = async (action: 'approve' | 'reject' | 'suspend' | 'archive') => {
    setError(null);
    const result = await moderateListingAction({ listingId, action });
    if (result.success) {
      const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended', archive: 'archived' };
      setStatus(statusMap[action]);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status !== 'approved' && (
          <AdminActionButton
            label="Approve"
            onConfirm={() => act('approve')}
            confirmMessage="Approve this listing? It will become publicly visible."
            className="text-green-700 border-green-200 hover:bg-green-50"
          />
        )}
        {status !== 'rejected' && status !== 'archived' && (
          <AdminActionButton
            label="Reject"
            onConfirm={() => act('reject')}
            confirmMessage="Reject this listing?"
            className="text-orange-700 border-orange-200 hover:bg-orange-50"
          />
        )}
        {status !== 'suspended' && status !== 'archived' && (
          <AdminActionButton
            label="Suspend"
            onConfirm={() => act('suspend')}
            confirmMessage="Suspend this listing? It will be hidden publicly."
            className="text-red-600 border-red-200 hover:bg-red-50"
          />
        )}
        {status !== 'archived' && (
          <AdminActionButton
            label="Archive"
            onConfirm={() => act('archive')}
            confirmMessage="Archive this listing?"
          />
        )}
      </div>
    </div>
  );
}
