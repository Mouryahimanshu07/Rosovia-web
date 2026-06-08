import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Calendar } from 'lucide-react';

import { createWebServerClient } from '~/lib/supabase/server';
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
  
  // 1. Fetch base profile
  const baseProfile = await getProfileByUsername(supabase, params.username);
  if (!baseProfile) notFound();

  // 2. Fetch authenticated session and resolve current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserProfile = user ? await getCurrentProfile(supabase) : null;
  const isOwnProfile = currentUserProfile !== null && currentUserProfile.id === baseProfile.id;

  // 3. Fetch follow status and counts
  const [followStats, initialFollowing] = await Promise.all([
    getProfileFollowStats(supabase, baseProfile.id),
    user ? isCurrentUserFollowingProfile(supabase, baseProfile.id) : Promise.resolve(false),
  ]);

  // 4. Fetch creator profile check
  const isCreator = baseProfile.role === 'creator';
  let creatorProfile: CreatorProfileWithCategory | null = null;

  if (isCreator) {
    let { data: rawCreatorProfile } = await supabase
      .from('creator_profiles')
      .select('*, categories(name, slug)')
      .eq('user_id', baseProfile.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!rawCreatorProfile) {
      try {
        await ensureCreatorProfileForProfile(supabase, baseProfile.id);
        const { data: rawEnsured } = await supabase
          .from('creator_profiles')
          .select('*, categories(name, slug)')
          .eq('user_id', baseProfile.id)
          .is('deleted_at', null)
          .maybeSingle();
        rawCreatorProfile = rawEnsured;
      } catch (err) {
        console.error('Failed to ensure creator profile on page load:', err);
      }
    }

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

  // 5. Query creator-only tabs data in parallel if profile is creator
  let creatorTabsData = null;
  if (creatorProfile) {
    const [reviews, listings, portfolioMedia, collections, workPosts] = await Promise.all([
      listReviewsForPublicCreator(supabase, creatorProfile.id),
      listCreatorPublicListings(supabase, creatorProfile.id),
      listCreatorPublicPortfolioMedia(supabase, baseProfile.id),
      listCollectionsForPublicProfile(supabase, creatorProfile.id),
      listPublicPostsForCreatorProfile(supabase, creatorProfile.id, {
        isFollowing: initialFollowing,
        isSelf: !!isOwnProfile,
      }),
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

  // Formatting helpers
  const joinedDate = new Date(baseProfile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  
  const location = [baseProfile.city, baseProfile.state, baseProfile.country].filter(Boolean).join(', ');

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* ── PROFILE HERO BANNER SECTION ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative">
        {/* Cover Banner */}
        <div className="w-full h-44 sm:h-64 relative bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 flex items-center justify-center overflow-hidden">
          {baseProfile.cover_image_url ? (
            <Image
              src={baseProfile.cover_image_url}
              alt={`${baseProfile.full_name || baseProfile.username} cover banner`}
              fill
              unoptimized
              className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
              priority
            />
          ) : (
            <>
              {/* Glassmorphic Background Shapes */}
              <div className="absolute top-[-20%] left-[-10%] w-72 h-72 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-30%] right-[-10%] w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-black text-6xl tracking-widest pointer-events-none select-none uppercase">
                {creatorProfile?.category_name ?? 'ROSOVIA'}
              </div>
            </>
          )}

          {creatorProfile?.website_url && (
            <a
              href={creatorProfile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white hover:bg-black/60 px-4 py-1.5 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Website
            </a>
          )}
        </div>

        {/* Identity Overlay Area */}
        <div className="px-6 pb-6 pt-4 sm:px-8 relative flex flex-col sm:flex-row items-center sm:items-end sm:justify-between gap-4">
          {/* Avatar & User details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:-mt-24 z-10">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white p-1.5 shadow-xl border border-gray-100 flex-shrink-0 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]">
              <div className="w-full h-full rounded-2xl overflow-hidden relative bg-indigo-50 border border-gray-100">
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
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-indigo-300 bg-indigo-50/50">
                    {(baseProfile.full_name || baseProfile.username || 'R').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center sm:text-left space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  {baseProfile.full_name || baseProfile.username}
                </h1>
                {creatorProfile && (
                  <VerificationBadge level={creatorProfile.verification_level} />
                )}
              </div>
              
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-gray-500 font-semibold">
                <span>@{baseProfile.username}</span>
                <span>•</span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-extrabold text-gray-600">
                  {baseProfile.role}
                </span>
                {creatorProfile?.category_name && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-extrabold text-indigo-600">
                      {creatorProfile.category_name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs: Owner vs Visitor buttons */}
          <div className="flex items-center gap-3 z-10 w-full sm:w-auto justify-center">
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

        {/* Info Grid (Follow Stats, Location, Joined Date, Bio) */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/30">
          {/* Left Column: Stats & Location */}
          <div className="space-y-3.5 text-sm font-semibold">
            {/* Follow stats */}
            <div className="flex items-center gap-5 text-gray-700">
              <Link href={`/u/${baseProfile.username}/followers`} className="hover:text-indigo-600 transition">
                <span className="text-gray-900 font-extrabold text-base">{followStats.followersCount}</span>{' '}
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Followers</span>
              </Link>
              <Link href={`/u/${baseProfile.username}/following`} className="hover:text-indigo-600 transition">
                <span className="text-gray-900 font-extrabold text-base">{followStats.followingCount}</span>{' '}
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Following</span>
              </Link>
            </div>

            {/* Location & Joined Date */}
            <div className="space-y-2 text-gray-500 text-xs font-bold uppercase tracking-wider">
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span>Joined {joinedDate}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Short Bio */}
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Bio</h3>
            <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">
              {baseProfile.bio || `${baseProfile.full_name || baseProfile.username} hasn't written a biography yet.`}
            </p>
          </div>
        </div>
      </div>

      {/* ── ENHANCED CREATOR SECTIONS ────────────────────────── */}
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
