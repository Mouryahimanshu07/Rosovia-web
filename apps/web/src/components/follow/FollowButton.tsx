'use client';

import { useState, useTransition } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { followCreatorAction, unfollowCreatorAction } from '~/app/actions/follows';

interface FollowButtonProps {
  creatorProfileId: string;
  initialFollowing: boolean;
  compact?: boolean;
}

export function FollowButton({
  creatorProfileId,
  initialFollowing,
  compact = false,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const action = following
        ? unfollowCreatorAction(creatorProfileId)
        : followCreatorAction(creatorProfileId);

      const result = await action;

      if (result.success) {
        setFollowing(!following);
      } else {
        if (result.error === 'Not authenticated') {
          window.location.href = '/login';
          return;
        }
        // Show error toast or alert
        alert(result.error);
      }
    });
  };

  if (compact) {
    return (
      <button
        id={`follow-btn-${creatorProfileId}`}
        onClick={handleClick}
        disabled={isPending}
        title={following ? 'Unfollow' : 'Follow'}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
          ${following
            ? 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
            : 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : following ? (
          <UserCheck className="h-3.5 w-3.5" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      id={`follow-btn-${creatorProfileId}`}
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95
        ${following
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
          : 'border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-sm shadow-indigo-200'
        }`}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <UserCheck className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </button>
  );
}
