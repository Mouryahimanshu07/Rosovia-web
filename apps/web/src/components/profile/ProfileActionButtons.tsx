'use client';

import Link from 'next/link';
import { Edit3, MessageSquare, PlusCircle, LayoutDashboard, FileText, LogIn } from 'lucide-react';
import { ProfileFollowButton } from '~/components/follow/profile-follow-button';

interface ProfileActionButtonsProps {
  isOwner: boolean;
  isAuthenticated: boolean;
  profileId: string;
  username: string;
  isCreator: boolean;
  creatorProfileId?: string | null;
  hasCreatorCategory?: boolean;
  initialFollowing: boolean;
}

export function ProfileActionButtons({
  isOwner,
  isAuthenticated,
  profileId,
  username,
  isCreator,
  creatorProfileId,
  hasCreatorCategory = false,
  initialFollowing,
}: ProfileActionButtonsProps) {
  // Set consistent h-10 height, rounded-xl corners, text size and layout
  const buttonBaseClass =
    'inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.98] w-full text-center';

  if (isOwner) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full sm:w-72 md:w-80" id="owner-action-buttons">
        <Link
          href={`/u/${username}/edit`}
          id="edit-profile-btn"
          className={`${buttonBaseClass} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`}
        >
          <Edit3 className="h-4 w-4 shrink-0" />
          <span className="truncate">Edit Profile</span>
        </Link>

        {isCreator ? (
          <>
            <Link
              href={`/u/${username}/posts/new`}
              id="create-post-btn"
              className={`${buttonBaseClass} bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">Post Work</span>
            </Link>
            <Link
              href={`/u/${username}/posts`}
              id="manage-posts-btn"
              className={`${buttonBaseClass} bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">Manage Posts</span>
            </Link>
          </>
        ) : null}

        <Link
          href="/dashboard"
          id="dashboard-btn"
          className={`${buttonBaseClass} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 ${
            !isCreator ? 'col-span-2' : ''
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="truncate">Dashboard</span>
        </Link>
      </div>
    );
  }

  // Visitor view (authenticated or anonymous)
  return (
    <div className="grid grid-cols-2 gap-2 w-full sm:w-72 md:w-80" id="visitor-action-buttons">
      {isAuthenticated ? (
        <ProfileFollowButton
          followingProfileId={profileId}
          username={username}
          initialFollowing={initialFollowing}
        />
      ) : (
        <Link
          href={`/login?redirected_from=/u/${username}`}
          id="follow-login-btn"
          className={`${buttonBaseClass} bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-95`}
        >
          <LogIn className="h-4 w-4 shrink-0" />
          <span>Follow</span>
        </Link>
      )}

      {isAuthenticated ? (
        <Link
          href={`/dashboard/messages?new_chat_with_user_id=${profileId}`}
          id="message-btn"
          className={`${buttonBaseClass} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Message</span>
        </Link>
      ) : (
        <Link
          href={`/login?redirected_from=/u/${username}`}
          id="message-login-btn"
          className={`${buttonBaseClass} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Message</span>
        </Link>
      )}

      {isCreator && (
        <div className="col-span-2">
          {isAuthenticated ? (
            <a
              href="#custom-order-panel"
              id="custom-order-btn"
              className={`${buttonBaseClass} bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              Request Custom Order
            </a>
          ) : (
            <Link
              href={`/login?redirected_from=/u/${username}`}
              id="custom-order-login-btn"
              className={`${buttonBaseClass} bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              Request Custom Order
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
