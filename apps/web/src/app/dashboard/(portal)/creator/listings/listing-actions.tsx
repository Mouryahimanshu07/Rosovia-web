'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ListingWithDetails } from '@rosovia/core';
import {
  submitListingForReviewAction,
  archiveListingAction,
  restoreListingToDraftAction,
} from './actions';

interface ListingActionsProps {
  listing: ListingWithDetails;
}

export function ListingActions({ listing }: ListingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = listing.status as string; // store as string to avoid TS narrowing conflicts

  const handle = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success) alert(result.error ?? 'Action failed');
      else router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href={`/dashboard/creator/listings/${listing.id}/edit`}
        className="text-xs text-indigo-600 hover:underline"
      >
        Edit
      </a>

      {status === 'draft' && (
        <button
          disabled={isPending}
          onClick={() => handle(() => submitListingForReviewAction(listing.id))}
          className="text-xs text-amber-600 hover:underline disabled:opacity-50"
        >
          Submit for Review
        </button>
      )}

      {(status === 'archived' || status === 'rejected') ? (
        <button
          disabled={isPending}
          onClick={() => handle(() => restoreListingToDraftAction(listing.id))}
          className="text-xs text-gray-600 hover:underline disabled:opacity-50"
        >
          Restore to Draft
        </button>
      ) : status !== 'suspended' && status !== 'archived' ? (
        <button
          disabled={isPending}
          onClick={() => handle(() => archiveListingAction(listing.id))}
          className="text-xs text-gray-500 hover:underline disabled:opacity-50"
        >
          Archive
        </button>
      ) : null}
    </div>
  );
}
