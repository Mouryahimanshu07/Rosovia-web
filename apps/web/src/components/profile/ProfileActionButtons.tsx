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
  if (isOwner) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-center" id="owner-action-buttons">
        <Link
          href={`/u/${username}/edit`}
          id="edit-profile-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition duration-200 shadow-sm active:scale-95"
        >
          <Edit3 className="h-4 w-4" />
          Edit Profile
        </Link>

        {isCreator && (
          <>
            <Link
              href={`/u/${username}/posts/new`}
              id="create-post-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold transition duration-200 shadow-sm active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              Post Your Work
            </Link>
            <Link
              href={`/u/${username}/posts`}
              id="manage-posts-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 border border-indigo-100 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition duration-200 shadow-sm active:scale-95"
            >
              <FileText className="h-4 w-4" />
              Manage Posts
            </Link>
          </>
        )}

        <Link
          href="/dashboard"
          id="dashboard-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition duration-200 shadow-sm active:scale-95"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    );
  }

  // Visitor view (authenticated or anonymous)
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center" id="visitor-action-buttons">
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-transparent bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white hover:opacity-90 shadow-sm shadow-indigo-100 text-sm font-semibold transition-all duration-200 active:scale-95"
        >
          <LogIn className="h-4 w-4" />
          Follow
        </Link>
      )}

      {isAuthenticated ? (
        <Link
          href={`/dashboard/messages?new_chat_with_user_id=${profileId}`}
          id="message-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition duration-200 shadow-sm active:scale-95"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Link>
      ) : (
        <Link
          href={`/login?redirected_from=/u/${username}`}
          id="message-login-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition duration-200 shadow-sm active:scale-95"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Link>
      )}

      {isCreator && (
        isAuthenticated ? (
          <a
            href="#custom-order-panel"
            id="custom-order-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold transition duration-200 shadow-sm active:scale-95"
          >
            Request Custom Order
          </a>
        ) : (
          <Link
            href={`/login?redirected_from=/u/${username}`}
            id="custom-order-login-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold transition duration-200 shadow-sm active:scale-95"
          >
            Request Custom Order
          </Link>
        )
      )}
    </div>
  );
}
