import Link from 'next/link';
import Image from 'next/image';
import type { Profile } from '@rosovia/core';
import { User, Sparkles } from 'lucide-react';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const displayName = profile.full_name || profile.username || 'Anonymous';
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const profileUrl = profile.username ? `/u/${profile.username}` : `/explore`;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg">
      <div>
        {/* Header: Avatar and Role Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-100 bg-slate-50 flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                fill
                sizes="64px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 text-xl font-bold text-indigo-600">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {profile.role === 'creator' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              <Sparkles className="h-3 w-3" /> Creator
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
              <User className="h-3 w-3" /> Buyer
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="mt-4 space-y-1">
          <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {displayName}
          </h3>
          {profile.username && (
            <p className="text-sm font-medium text-slate-400">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="text-sm text-slate-600 line-clamp-2 mt-2 leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 flex-wrap">
        <div className="min-w-0">
          {location ? (
            <p className="text-xs text-slate-400 truncate">{location}</p>
          ) : (
            <p className="text-xs text-slate-300">India</p>
          )}
        </div>
        {profile.username ? (
          <Link
            href={profileUrl}
            className="inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
          >
            View Profile
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-400 cursor-not-allowed">
            No Username
          </span>
        )}
      </div>
    </div>
  );
}
