import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import type { ListingWithDetails } from '@rosovia/core';
export const dynamic = 'force-dynamic';
import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import {
  getPublicCreatorProfileBySlug,
  listReviewsForPublicCreator,
  listCreatorPublicListings,
  listCreatorPublicPortfolioMedia,
  isCreatorSavedForUser,
  listCollectionsForPublicProfile,
  isCurrentUserFollowingProfile,
  listPublicPostsForCreatorProfile,
} from '@rosovia/api';
import { SaveButton } from '~/components/saved/save-button';
import { VerificationBadge } from '~/components/creator/verification-badge';
import { RatingSummary } from '~/components/creator/rating-summary';
import { CreatorTabs } from '~/components/creator/creator-tabs';
import { ProfileFollowButton } from '~/components/follow/profile-follow-button';
import { MessageCircle, Edit3, PlusSquare, LayoutList } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createWebServerClient();
  const profile = await getPublicCreatorProfileBySlug(supabase, params.slug);
  if (!profile) return { title: 'Creator not found — Rosovia' };
  return {
    title: `${profile.display_name} — Rosovia`,
    description: profile.bio ?? `${profile.display_name}'s creator profile on Rosovia.`,
    openGraph: {
      title: `${profile.display_name} — Rosovia`,
      description: profile.bio ?? `${profile.display_name}'s creator profile on Rosovia.`,
      ...(profile.profile_image_url ? { images: [{ url: profile.profile_image_url }] } : {}),
    },
  };
}

export default async function CreatorPublicProfilePage({ params }: Props) {
  const supabase = createWebServerClient();
  
  // 1. Fetch creator profile and current user profile in parallel (request-memoized)
  const [profile, ownProfile] = await Promise.all([
    getPublicCreatorProfileBySlug(supabase, params.slug),
    getServerProfile(),
  ]);

  if (!profile) notFound();

  const user = ownProfile;
  const isOwnProfile = ownProfile !== null && ownProfile.id === profile.user_id;
  const ownerUsername = isOwnProfile ? ownProfile.username : null;

  // 2. Fetch initial saved/following states in parallel
  const [initialSaved, initialFollowing] = await Promise.all([
    ownProfile ? isCreatorSavedForUser(supabase, profile.id) : Promise.resolve(false),
    ownProfile ? isCurrentUserFollowingProfile(supabase, profile.user_id) : Promise.resolve(false),
  ]);

  // 3. Parallelize public data fetching
  const [reviews, listings, portfolioMedia, collections, workPosts] = await Promise.all([
    listReviewsForPublicCreator(supabase, profile.id),
    listCreatorPublicListings(supabase, profile.id),
    listCreatorPublicPortfolioMedia(supabase, profile.user_id),
    listCollectionsForPublicProfile(supabase, profile.id),
    listPublicPostsForCreatorProfile(
      supabase,
      profile.id,
      {
        isFollowing: initialFollowing,
        isSelf: !!isOwnProfile,
      },
      ownProfile?.id
    ),
  ]);

  // Partition listings into appropriate sections
  const services = listings.filter((l: ListingWithDetails) =>
    ['service', 'mentorship', 'workshop', 'event_booking'].includes(l.listing_type)
  );
  const shop = listings.filter((l: ListingWithDetails) => l.listing_type === 'product');
  const portfolioListings = listings.filter((l: ListingWithDetails) => l.listing_type === 'portfolio');

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* ── COVER & IDENTITY HERO SECTION ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative">
        {/* Large Cover Banner Image */}
        <div className="w-full h-44 sm:h-64 relative bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 flex items-center justify-center overflow-hidden">
          {profile.cover_image_url ? (
            <Image
              src={profile.cover_image_url}
              alt={`${profile.display_name} cover banner`}
              fill
              className="object-cover opacity-90 transition-transform duration-700 hover:scale-105"
              priority
            />
          ) : (
            <>
              {/* Modern Glassmorphic Background Shapes */}
              <div className="absolute top-[-20%] left-[-10%] w-72 h-72 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-30%] right-[-10%] w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-black text-6xl tracking-widest pointer-events-none select-none uppercase">
                {profile.category_name ?? 'ROSOVIA'}
              </div>
            </>
          )}

          {/* Safe Link / Website Indicator */}
          {profile.website_url && (
            <a
              href={profile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white/90 hover:bg-black/60 px-4 py-1.5 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
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
          {/* Avatar Container */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:-mt-24 z-10">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white p-1.5 shadow-xl border border-gray-100 flex-shrink-0 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]">
              <div className="w-full h-full rounded-2xl overflow-hidden relative bg-indigo-50 border border-gray-100">
                {profile.profile_image_url ? (
                  <Image
                    src={profile.profile_image_url}
                    alt={profile.display_name}
                    fill
                    sizes="(max-width: 640px) 112px, 144px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-indigo-300 bg-indigo-50/50">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info Details */}
            <div className="text-center sm:text-left space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap justify-center sm:justify-start">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                    {profile.display_name}
                  </h1>
                  {user && (
                    <SaveButton
                      targetType="creator"
                      targetId={profile.id}
                      initialSaved={initialSaved}
                    />
                  )}
                </div>
                <VerificationBadge level={profile.verification_level} className="shadow-sm" />
              </div>

              {profile.headline ? (
                <p className="text-sm font-semibold text-gray-600 max-w-lg">
                  {profile.headline}
                </p>
              ) : (
                profile.category_name && (
                  <p className="text-sm font-bold text-indigo-600 tracking-wide uppercase">
                    {profile.category_name}
                  </p>
                )
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                <span className="text-gray-500">@{profile.slug}</span>
                {location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-end mt-2 sm:mt-0 z-10">
            {isOwnProfile ? (
              /* Owner: Edit Profile + Post Your Work + Manage Posts */
              <>
                <Link
                  href={ownerUsername ? `/u/${ownerUsername}/edit` : '/dashboard/profile'}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 duration-150"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Link>
                <Link
                  href={ownerUsername ? `/u/${ownerUsername}/posts/new` : '/dashboard/creator/posts/new'}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 duration-150"
                >
                  <PlusSquare className="h-4 w-4" />
                  Post Your Work
                </Link>
                <Link
                  href={ownerUsername ? `/u/${ownerUsername}/posts` : '/dashboard/creator/posts'}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm active:scale-95 duration-150"
                >
                  <LayoutList className="h-4 w-4" />
                  Manage Posts
                </Link>
              </>
            ) : (
              /* Visitor: Follow + Message + Custom Order */
              <>
                <ProfileFollowButton
                  followingProfileId={profile.user_id}
                  username={profile.slug}
                  initialFollowing={initialFollowing}
                />

                {/* Message CTA */}
                {user ? (
                  <Link
                    href={`/messages?creator=${profile.id}`}
                    id={`message-creator-${profile.id}`}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-700 transition-all shadow-sm hover:shadow active:scale-95 duration-150"
                  >
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    Message
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-700 transition-all shadow-sm active:scale-95 duration-150"
                  >
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    Message
                  </Link>
                )}

                {/* Prominent Custom Order Request CTA */}
                <Link
                  href="#custom-order-panel"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 duration-150"
                >
                  Custom Order
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TRUST & STATS OVERVIEW CARDS ───────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Orders Done',
            value: profile.total_orders,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50/30',
            desc: 'Verified sales',
          },
          {
            label: 'Followers',
            value: profile.total_followers,
            color: 'text-purple-600',
            bg: 'bg-purple-50/30',
            desc: 'Platform reach',
          },
          {
            label: 'Reviews Received',
            value: profile.rating_count,
            color: 'text-amber-500',
            bg: 'bg-amber-50/20',
            desc: `${profile.rating_avg.toFixed(1)} ★ Rating average`,
          },
          {
            label: 'Trust Level',
            value: profile.verification_level === 'trusted_seller' ? 'Trusted' : profile.is_verified ? 'Verified' : 'Member',
            color: profile.is_verified ? 'text-emerald-600' : 'text-gray-500',
            bg: profile.is_verified ? 'bg-emerald-50/20' : 'bg-gray-50/40',
            desc: profile.is_verified ? 'Security audited' : 'Identity pending',
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={`border border-gray-100 rounded-2xl p-5 shadow-sm text-center bg-white relative overflow-hidden transition-all duration-300 hover:border-gray-200 hover:shadow-md`}
          >
            {/* Subtle inner card accent circles */}
            <div className={`absolute -right-3 -bottom-3 w-12 h-12 ${stat.bg} rounded-full blur-xl`} />
            <p className={`text-2xl sm:text-3xl font-black ${stat.color} tracking-tight`}>
              {stat.value}
            </p>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mt-1">
              {stat.label}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* ── REDESIGNED MODULAR TAB PANELS ────────────────────────── */}
      <CreatorTabs
        profile={profile}
        services={services}
        shop={shop}
        portfolioListings={portfolioListings}
        portfolioMedia={portfolioMedia}
        reviews={reviews}
        user={user}
        collections={collections}
        workPosts={workPosts}
        isOwnProfile={isOwnProfile}
        username={ownerUsername ?? undefined}
      />
    </main>
  );
}

