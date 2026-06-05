'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { followProfileAction, unfollowProfileAction } from '~/app/actions/follows';

interface ProfileFollowButtonProps {
  followingProfileId: string;
  username: string;
  initialFollowing: boolean;
  compact?: boolean;
}

export function ProfileFollowButton({
  followingProfileId,
  username,
  initialFollowing,
  compact = false,
}: ProfileFollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  // Sync state with prop if it changes externally
  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startTransition(async () => {
      const action = following
        ? unfollowProfileAction(followingProfileId, username)
        : followProfileAction(followingProfileId, username);

      const result = await action;

      if (result.success) {
        setFollowing(!following);
        router.refresh();
      } else {
        if (result.error === 'Not authenticated') {
          window.location.href = '/login';
          return;
        }
        alert(result.error);
      }
    });
  };

  if (compact) {
    return (
      <button
        id={`profile-follow-btn-${followingProfileId}`}
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
      id={`profile-follow-btn-${followingProfileId}`}
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95
        ${following
          ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
          : 'border-transparent bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white hover:opacity-90 shadow-sm shadow-indigo-100'
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
