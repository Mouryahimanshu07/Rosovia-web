import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { createWebServerClient } from '~/lib/supabase/server';
import { getProfileByUsername, listProfileFollowing, isCurrentUserFollowingProfile } from '@rosovia/api';
import { ProfileFollowButton } from '~/components/follow/profile-follow-button';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function FollowingListPage({ params }: Props) {
  const supabase = createWebServerClient();
  
  // 1. Fetch base profile
  const baseProfile = await getProfileByUsername(supabase, params.username);
  if (!baseProfile) notFound();

  // 2. Fetch authenticated session
  const { data: { user } } = await supabase.auth.getUser();

  // 3. List following
  const following = await listProfileFollowing(supabase, baseProfile.id);

  // 4. For each following, check if current user is following them
  const followingWithFollowingState = await Promise.all(
    following.map(async (f) => {
      const isFollowing = user ? await isCurrentUserFollowingProfile(supabase, f.id) : false;
      return {
        ...f,
        isFollowing,
        isSelf: user && user.id === f.auth_user_id,
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
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Following</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            @{baseProfile.username}&apos;s connections
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm divide-y divide-gray-100">
        {followingWithFollowingState.length > 0 ? (
          <div className="space-y-4 divide-y divide-gray-50">
            {followingWithFollowingState.map((f) => (
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
            <p className="text-sm font-semibold text-gray-600">Not following anyone yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              When @{baseProfile.username} follows other buyers or creators, they will show up in this directory.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
