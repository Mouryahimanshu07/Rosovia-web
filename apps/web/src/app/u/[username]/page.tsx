import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Calendar } from 'lucide-react';

import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import {
  getProfileByUsername,
  getProfileFollowStats,
  isCurrentUserFollowingProfile,
  listReviewsForPublicCreator,
  listCreatorPublicListings,
  listCreatorPublicPortfolioMedia,
  listCollectionsForPublicProfile,
  listPublicPostsForCreatorProfile,
  getCurrentProfile,
  ensureCreatorProfileForProfile,
} from '@rosovia/api';
import type { ListingWithDetails, CreatorProfileWithCategory } from '@rosovia/core';
import { ProfileActionButtons } from '~/components/profile/ProfileActionButtons';
import { CreatorTabs } from '~/components/creator/creator-tabs';
import { VerificationBadge } from '~/components/creator/verification-badge';
import { ProfileTalentChips } from '~/components/profile/ProfileTalentChips';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createWebServerClient();
  const profile = await getProfileByUsername(supabase, params.username);
  if (!profile) return { title: 'User not found — Rosovia' };
  
  return {
    title: `${profile.full_name || profile.username} (@${profile.username}) — Rosovia`,
    description: profile.bio ?? `${profile.full_name || profile.username}'s public profile on Rosovia.`,
  };
}

export default async function UserPublicProfilePage({ params }: Props) {
  const supabase = createWebServerClient();
  
  // 1. Fetch base profile and current user profile in parallel (request-memoized)
  const [baseProfile, currentUserProfile] = await Promise.all([
    getProfileByUsername(supabase, params.username),
    getServerProfile(),
  ]);

  if (!baseProfile) notFound();

  const user = currentUserProfile;
  const isOwnProfile = currentUserProfile !== null && currentUserProfile.id === baseProfile.id;

  // 2. Fetch follow status/counts and creator profile check in parallel
  const isCreator = baseProfile.role === 'creator';
  let creatorProfilePromise: Promise<any> = Promise.resolve(null);

  if (isCreator) {
    creatorProfilePromise = Promise.resolve(
      supabase
        .from('creator_profiles')
        .select('*, categories(name, slug)')
        .eq('user_id', baseProfile.id)
        .is('deleted_at', null)
        .maybeSingle()
        .then(async ({ data: rawCreatorProfile }) => {
          if (!rawCreatorProfile) {
            try {
              await ensureCreatorProfileForProfile(supabase, baseProfile.id);
              const { data: rawEnsured } = await supabase
                .from('creator_profiles')
                .select('*, categories(name, slug)')
                .eq('user_id', baseProfile.id)
                .is('deleted_at', null)
                .maybeSingle();
              return rawEnsured;
            } catch (err) {
              console.error('Failed to ensure creator profile on page load:', err);
              return null;
            }
          }
          return rawCreatorProfile;
        })
    );
  }

  const [followStats, initialFollowing, rawCreatorProfile] = await Promise.all([
    getProfileFollowStats(supabase, baseProfile.id),
    currentUserProfile ? isCurrentUserFollowingProfile(supabase, baseProfile.id) : Promise.resolve(false),
    creatorProfilePromise,
  ]);

  let creatorProfile: CreatorProfileWithCategory | null = null;

  if (isCreator) {
    if (rawCreatorProfile) {
      creatorProfile = {
        ...rawCreatorProfile,
        category_name: (rawCreatorProfile.categories as any)?.name ?? null,
        category_slug: (rawCreatorProfile.categories as any)?.slug ?? null,
      } as CreatorProfileWithCategory;
    } else {
      // Safe fallback object for UI
      creatorProfile = {
        id: baseProfile.id,
        user_id: baseProfile.id,
        display_name: baseProfile.full_name || baseProfile.username || 'Creator',
        slug: baseProfile.username || baseProfile.id,
        bio: baseProfile.bio ?? null,
        story: null,
        primary_category_id: null,
        skills: [],
        languages: [],
        city: baseProfile.city ?? null,
        state: baseProfile.state ?? null,
        country: baseProfile.country ?? 'India',
        profile_image_url: baseProfile.avatar_url ?? null,
        cover_image_url: baseProfile.cover_image_url ?? null,
        intro_video_url: null,
        verification_level: 'none',
        is_verified: false,
        rating_avg: 0,
        rating_count: 0,
        total_orders: 0,
        total_followers: 0,
        headline: null,
        website_url: null,
        profile_theme: 'default',
        created_at: baseProfile.created_at,
        updated_at: baseProfile.updated_at,
        category_name: null,
        category_slug: null,
        profile_username: baseProfile.username ?? null,
      } as any;
    }
  }

  // 3. Query creator-only tabs data in parallel if profile is creator
  let creatorTabsData = null;
  if (creatorProfile) {
    const [reviews, listings, portfolioMedia, collections, workPosts] = await Promise.all([
      listReviewsForPublicCreator(supabase, creatorProfile.id),
      listCreatorPublicListings(supabase, creatorProfile.id),
      listCreatorPublicPortfolioMedia(supabase, baseProfile.id),
      listCollectionsForPublicProfile(supabase, creatorProfile.id),
      listPublicPostsForCreatorProfile(
        supabase,
        creatorProfile.id,
        {
          isFollowing: initialFollowing,
          isSelf: !!isOwnProfile,
        },
        currentUserProfile?.id
      ),
    ]);

    const services = listings.filter((l: ListingWithDetails) =>
      ['service', 'mentorship', 'workshop', 'event_booking'].includes(l.listing_type)
    );
    const shop = listings.filter((l: ListingWithDetails) => l.listing_type === 'product');
    const portfolioListings = listings.filter((l: ListingWithDetails) => l.listing_type === 'portfolio');

    creatorTabsData = {
      services,
      shop,
      portfolioListings,
      portfolioMedia,
      reviews,
      collections,
      workPosts,
    };
  }

  const postsCount = creatorTabsData?.workPosts?.length ?? 0;
  const servicesCount = creatorTabsData?.services?.length ?? 0;

  // Formatting helpers
  const joinedDate = new Date(baseProfile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  
  const location = [baseProfile.city, baseProfile.state, baseProfile.country].filter(Boolean).join(', ');

  // Bio fallbacks
  const bioText = baseProfile.bio 
    ? baseProfile.bio 
    : isOwnProfile 
      ? 'Add a short bio to tell people about your work.'
      : 'No bio yet.';

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* ── MAIN PROFILE CARD CONTAINER ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm relative">
        {/* Cover Banner (No text overlay) */}
        <div className="w-full h-[160px] md:h-[240px] relative bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
          {baseProfile.cover_image_url ? (
            <Image
              src={baseProfile.cover_image_url}
              alt="cover banner"
              fill
              unoptimized
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50" />
          )}

          {creatorProfile?.website_url && (
            <a
              href={creatorProfile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 px-4 py-1.5 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Website
            </a>
          )}
        </div>

        {/* White Identity Panel below cover */}
        <div className="px-6 pb-6 pt-4 md:px-8 flex flex-col md:flex-row items-center md:items-start md:justify-between gap-6">
          {/* Avatar and Identity Details */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-5 w-full">
            {/* Avatar overlapping cover by 60px */}
            <div className="-mt-[60px] md:-mt-[90px] w-24 h-24 md:w-[140px] md:h-[140px] rounded-full bg-white p-1 shadow-md border-4 border-white flex-shrink-0 relative overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden relative bg-indigo-50">
                {baseProfile.avatar_url ? (
                  <Image
                    src={baseProfile.avatar_url}
                    alt={baseProfile.full_name || baseProfile.username || ''}
                    fill
                    unoptimized
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl md:text-5xl font-black text-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50">
                    {(baseProfile.full_name || baseProfile.username || 'R').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Middle details (completely on white background) */}
            <div className="text-center md:text-left space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-center md:justify-start gap-1.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-tight">
                  {baseProfile.full_name || baseProfile.username}
                </h1>
                {creatorProfile && (
                  <VerificationBadge level={creatorProfile.verification_level} />
                )}
              </div>
              
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs md:text-sm text-gray-500 font-semibold flex-wrap">
                <span className="text-indigo-600">@{baseProfile.username}</span>
                <span>•</span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-extrabold text-indigo-700 border border-indigo-100/50">
                  {baseProfile.role}
                </span>
              </div>

              {/* Talent Chips */}
              {isCreator && (
                <ProfileTalentChips
                  categoryName={creatorProfile?.category_name}
                  skills={creatorProfile?.skills}
                  isOwner={isOwnProfile}
                  username={baseProfile.username || undefined}
                />
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="z-10 w-full md:w-auto shrink-0 flex justify-center md:justify-end">
            <ProfileActionButtons
              isOwner={isOwnProfile}
              isAuthenticated={!!user}
              profileId={baseProfile.id}
              username={baseProfile.username || ''}
              isCreator={isCreator}
              creatorProfileId={creatorProfile?.id ?? null}
              hasCreatorCategory={!!creatorProfile?.primary_category_id}
              initialFollowing={initialFollowing}
            />
          </div>
        </div>

        {/* Compact Stats Row (Desktop horizontal; Mobile 2x2 grid) */}
        <div className="border-t border-gray-100 py-3 px-6 md:px-8 bg-gray-50/15 grid grid-cols-2 md:flex md:flex-row md:items-center md:justify-start gap-y-2.5 gap-x-8 md:gap-x-12">
          <div className="flex items-baseline gap-1.5 justify-center md:justify-start">
            <span className="text-base font-bold text-gray-900 leading-none">{postsCount}</span>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Posts</span>
          </div>
          <Link href={`/u/${baseProfile.username}/followers`} className="flex items-baseline gap-1.5 justify-center md:justify-start hover:text-indigo-600 transition">
            <span className="text-base font-bold text-gray-900 leading-none">{followStats.followersCount}</span>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Followers</span>
          </Link>
          <Link href={`/u/${baseProfile.username}/following`} className="flex items-baseline gap-1.5 justify-center md:justify-start hover:text-indigo-600 transition">
            <span className="text-base font-bold text-gray-900 leading-none">{followStats.followingCount}</span>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Following</span>
          </Link>
          {isCreator && (
            <div className="flex items-baseline gap-1.5 justify-center md:justify-start">
              <span className="text-base font-bold text-gray-900 leading-none">{servicesCount}</span>
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Services</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ABOUT AND DETAILS SECTION ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left/Middle: About card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3 text-left">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600">About</h3>
          <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">
            {bioText}
          </p>
        </div>

        {/* Right: Details card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4 text-left flex flex-col justify-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Details</h3>
          
          <div className="space-y-3 text-sm text-gray-600 font-semibold">
            {/* Availability Badge */}
            {isCreator && (
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs uppercase font-extrabold tracking-wider">Available for work</span>
              </div>
            )}

            {location && (
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span>Joined {joinedDate}</span>
            </div>

            {creatorProfile && creatorProfile.languages && creatorProfile.languages.length > 0 && (
              <div className="flex items-start gap-2.5">
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 7.31 16.5 3 19" />
                </svg>
                <span>Languages: <span className="text-gray-900 font-bold">{creatorProfile.languages.join(', ')}</span></span>
              </div>
            )}

            {creatorProfile && creatorProfile.total_orders > 0 && (
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
                <span>{creatorProfile.total_orders} Orders Completed</span>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* ── CREATOR TABS SECTION ─────────────────────────────── */}
      {creatorProfile && creatorTabsData && (
        <section className="space-y-6">
          <CreatorTabs
            profile={creatorProfile}
            services={creatorTabsData.services}
            shop={creatorTabsData.shop}
            portfolioListings={creatorTabsData.portfolioListings}
            portfolioMedia={creatorTabsData.portfolioMedia}
            reviews={creatorTabsData.reviews}
            user={user}
            collections={creatorTabsData.collections}
            workPosts={creatorTabsData.workPosts}
            isOwnProfile={!!isOwnProfile}
            username={baseProfile.username ?? undefined}
          />
        </section>
      )}
    </main>
  );
}
