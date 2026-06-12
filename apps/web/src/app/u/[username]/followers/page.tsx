import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import { getProfileByUsername, listProfileFollowers, isCurrentUserFollowingProfile } from '@rosovia/api';
import { ProfileFollowButton } from '~/components/follow/profile-follow-button';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function FollowersListPage({ params }: Props) {
  const supabase = createWebServerClient();
  
  // 1. Fetch base profile and current user profile in parallel (request-memoized)
  const [baseProfile, currentUserProfile] = await Promise.all([
    getProfileByUsername(supabase, params.username),
    getServerProfile(),
  ]);

  if (!baseProfile) notFound();

  // 2. List followers
  const followers = await listProfileFollowers(supabase, baseProfile.id);

  // 3. For each follower, check if current user is following them
  const followersWithFollowingState = await Promise.all(
    followers.map(async (follower) => {
      const isFollowing = currentUserProfile ? await isCurrentUserFollowingProfile(supabase, follower.id) : false;
      return {
        ...follower,
        isFollowing,
        isSelf: currentUserProfile !== null && currentUserProfile.id === follower.id,
      };
    })
  );

  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/u/${baseProfile.username}`}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition duration-150"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Followers</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            @{baseProfile.username}&apos;s network
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm divide-y divide-gray-100">
        {followersWithFollowingState.length > 0 ? (
          <div className="space-y-4 divide-y divide-gray-50">
            {followersWithFollowingState.map((f) => (
              <div key={f.id} className="flex items-center justify-between pt-4 first:pt-0">
                <Link href={`/u/${f.username}`} className="flex items-center gap-3 group">
                  <div className="w-11 h-11 rounded-2xl overflow-hidden relative bg-indigo-50 border border-gray-100 flex-shrink-0">
                    {f.avatar_url ? (
                      <Image
                        src={f.avatar_url}
                        alt={f.full_name || f.username || ''}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-indigo-400">
                        {(f.full_name || f.username || 'R').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-900 leading-tight group-hover:text-indigo-600 transition">
                      {f.full_name || f.username}
                    </h4>
                    <p className="text-xs text-gray-400 font-medium">@{f.username}</p>
                  </div>
                </Link>

                {/* Follow button */}
                <div className="flex-shrink-0">
                  {!f.isSelf && (
                    <ProfileFollowButton
                      followingProfileId={f.id}
                      username={f.username || ''}
                      initialFollowing={f.isFollowing}
                      compact={true}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 space-y-2">
            <span className="text-3xl">👥</span>
            <p className="text-sm font-semibold text-gray-600">No followers yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              When users follow @{baseProfile.username}, they will show up in this directory list.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
