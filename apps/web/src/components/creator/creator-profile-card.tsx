import Link from 'next/link';
import Image from 'next/image';
import type { CreatorProfileWithCategory } from '@rosovia/core';
import { VerificationBadge } from './verification-badge';
import { RatingSummary } from './rating-summary';
import { ProfileTalentChips } from '../profile/ProfileTalentChips';

interface CreatorProfileCardProps {
  profile: CreatorProfileWithCategory;
}

export function CreatorProfileCard({ profile }: CreatorProfileCardProps) {
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const profileUrl = profile.profile_username
    ? `/u/${profile.profile_username}`
    : `/creators/${profile.slug}`;

  return (
    <Link
      href={profileUrl}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-gray-300"
    >
      {/* Avatar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
          {profile.profile_image_url ? (
            <Image
              src={profile.profile_image_url}
              alt={profile.display_name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-semibold bg-gray-50">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
            {profile.display_name}
          </p>
          <ProfileTalentChips
            categoryName={profile.category_name}
            skills={profile.skills}
            isOwner={false}
            limit={2}
          />
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{profile.bio}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 flex-wrap mt-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <VerificationBadge level={profile.verification_level} />
          {location && (
            <span className="text-xs text-gray-400">{location}</span>
          )}
        </div>
        <RatingSummary avg={profile.rating_avg} count={profile.rating_count} />
      </div>
    </Link>
  );
}
