'use client';

import { useState } from 'react';
import { moderateReviewAction } from '~/app/dashboard/admin/reviews/actions';
import { AdminActionButton } from './admin-action-button';

interface ReviewModerationActionsProps {
  reviewId: string;
  isHidden: boolean;
}

export function ReviewModerationActions({ reviewId, isHidden: initialHidden }: ReviewModerationActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(initialHidden);

  const toggle = async () => {
    setError(null);
    const action = hidden ? 'unhide' : 'hide';
    const result = await moderateReviewAction({ reviewId, action });
    if (result.success) {
      setHidden(!hidden);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <AdminActionButton
        label={hidden ? 'Unhide' : 'Hide'}
        onConfirm={toggle}
        confirmMessage={hidden ? 'Unhide this review?' : 'Hide this review from public view?'}
        className={hidden
          ? 'text-green-700 border-green-200 hover:bg-green-50'
          : 'text-red-600 border-red-200 hover:bg-red-50'}
      />
    </div>
  );
}
