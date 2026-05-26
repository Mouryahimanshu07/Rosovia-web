import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getPublicCreatorProfileBySlug,
  listReviewsForPublicCreator,
  listCreatorPublicListings,
  listCreatorPublicPortfolioMedia,
  isCreatorSavedForUser,
  listCollectionsForPublicProfile,
} from '@rosovia/api';
import { SaveButton } from '~/components/saved/save-button';
import { VerificationBadge } from '~/components/creator/verification-badge';
import { RatingSummary } from '~/components/creator/rating-summary';
import { CreatorTabs } from '~/components/creator/creator-tabs';

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
  };
}

export default async function CreatorPublicProfilePage({ params }: Props) {
  const supabase = createWebServerClient();
  const profile = await getPublicCreatorProfileBySlug(supabase, params.slug);

  if (!profile) notFound();

  // Parallelize public data fetching
  const [reviews, listings, portfolioMedia, collections] = await Promise.all([
    listReviewsForPublicCreator(supabase, profile.id),
    listCreatorPublicListings(supabase, profile.id),
    listCreatorPublicPortfolioMedia(supabase, profile.user_id),
    listCollectionsForPublicProfile(supabase, profile.id),
  ]);

  // Partition listings into appropriate sections
  const services = listings.filter((l) =>
    ['service', 'mentorship', 'workshop', 'event_booking'].includes(l.listing_type)
  );
  const shop = listings.filter((l) => l.listing_type === 'product');
  const portfolioListings = listings.filter((l) => l.listing_type === 'portfolio');

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');

  // Get authenticated user for custom requests & inquiries
  const { data: { user } } = await supabase.auth.getUser();

  const initialSaved = user ? await isCreatorSavedForUser(supabase, profile.id) : false;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header card with glassmorphism styling elements */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-50/40 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-24 h-24 rounded-full bg-indigo-50 border-2 border-indigo-100 overflow-hidden flex-shrink-0 relative shadow-sm">
          {profile.profile_image_url ? (
            <Image
              src={profile.profile_image_url}
              alt={profile.display_name}
              fill
              sizes="96px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-extrabold text-indigo-300 bg-indigo-50/50">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap justify-center sm:justify-start">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{profile.display_name}</h1>
              {user && (
                <SaveButton
                  targetType="creator"
                  targetId={profile.id}
                  initialSaved={initialSaved}
                />
              )}
            </div>
            <VerificationBadge level={profile.verification_level} className="mt-1 sm:mt-0 shadow-sm" />
          </div>
          {profile.category_name && (
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">{profile.category_name}</p>
          )}
          {location && (
            <p className="text-sm text-gray-400 flex items-center justify-center sm:justify-start gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </p>
          )}
          <div className="pt-1">
            <RatingSummary avg={profile.rating_avg} count={profile.rating_count} />
          </div>
        </div>
      </div>

      {/* Trust stats row */}
      <div className="grid grid-cols-3 gap-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
        <div className="space-y-1">
          <p className="text-2xl font-black text-indigo-600">{profile.total_orders}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Orders Done</p>
        </div>
        <div className="space-y-1 border-x border-gray-100">
          <p className="text-2xl font-black text-purple-600">{profile.total_followers}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Followers</p>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-black text-amber-500">{profile.rating_count}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Reviews</p>
        </div>
      </div>

      {/* Premium Content Tabs switcher */}
      <CreatorTabs
        profile={profile}
        services={services}
        shop={shop}
        portfolioListings={portfolioListings}
        portfolioMedia={portfolioMedia}
        reviews={reviews}
        user={user}
        collections={collections}
      />
    </main>
  );
}
