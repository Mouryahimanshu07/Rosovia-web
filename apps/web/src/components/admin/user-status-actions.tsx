'use client';

import { useState } from 'react';
import { updateUserStatusAction } from '~/app/dashboard/admin/users/actions';
import { AdminActionButton } from './admin-action-button';

interface UserStatusActionsProps {
  profileId: string;
  currentStatus: string;
  isSelf: boolean;
}

export function UserStatusActions({ profileId, currentStatus, isSelf }: UserStatusActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus);

  const handleSuspend = async () => {
    setError(null);
    const result = await updateUserStatusAction({ userId: profileId, action: 'suspend' });
    if (result.success) {
      setOptimisticStatus('suspended');
    } else {
      setError(result.error);
    }
  };

  const handleReactivate = async () => {
    setError(null);
    const result = await updateUserStatusAction({ userId: profileId, action: 'reactivate' });
    if (result.success) {
      setOptimisticStatus('active');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {optimisticStatus === 'active' && !isSelf && (
          <AdminActionButton
            label="Suspend"
            onConfirm={handleSuspend}
            confirmMessage="Suspend this user? They will lose dashboard access immediately."
            className="text-red-600 border-red-200 hover:bg-red-50"
            requireConfirm
          />
        )}
        {optimisticStatus === 'suspended' && (
          <AdminActionButton
            label="Reactivate"
            onConfirm={handleReactivate}
            confirmMessage="Reactivate this user?"
            className="text-green-700 border-green-200 hover:bg-green-50"
            requireConfirm
          />
        )}
        {isSelf && (
          <span className="text-xs text-gray-400 italic">Cannot modify own account</span>
        )}
      </div>
    </div>
  );
}
