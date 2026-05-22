import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
import { createWebServerClient } from '~/lib/supabase/server';
import { getPublicCreatorProfileBySlug, listReviewsForPublicCreator } from '@rosovia/api';
import { VerificationBadge } from '~/components/creator/verification-badge';
import { RatingSummary } from '~/components/creator/rating-summary';
import { InquiryForm } from '~/components/inquiry/inquiry-form';
import { CustomOrderForm } from '~/components/custom-order/custom-order-form';
import { ReviewList } from '~/components/review/review-list';
import { ReportButton } from '~/components/report/report-button';

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

  const reviews = await listReviewsForPublicCreator(supabase, profile.id);

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');

  // Check if the visitor is authenticated (for inquiry section)
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
          {profile.profile_image_url ? (
            <Image src={profile.profile_image_url} alt={profile.display_name} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-semibold text-gray-400">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{profile.display_name}</h1>
            <VerificationBadge level={profile.verification_level} />
          </div>
          {profile.category_name && (
            <p className="text-sm text-gray-500 mt-0.5">{profile.category_name}</p>
          )}
          {location && <p className="text-sm text-gray-400 mt-1">{location}</p>}
          <div className="mt-2">
            <RatingSummary avg={profile.rating_avg} count={profile.rating_count} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 mb-8 text-center text-sm">
        <div>
          <p className="font-semibold text-gray-900">{profile.total_orders}</p>
          <p className="text-gray-500">Orders</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{profile.total_followers}</p>
          <p className="text-gray-500">Followers</p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{profile.rating_count}</p>
          <p className="text-gray-500">Reviews</p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">About</h2>
          <p className="text-gray-600 text-sm leading-relaxed">{profile.bio}</p>
        </section>
      )}

      {/* Story */}
      {profile.story && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">My Story</h2>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{profile.story}</p>
        </section>
      )}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span key={skill} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Languages */}
      {profile.languages.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Languages</h2>
          <div className="flex flex-wrap gap-2">
            {profile.languages.map((lang) => (
              <span key={lang} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                {lang}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Reviews Section — Module 12 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Reviews ({profile.rating_count})
        </h2>
        <ReviewList
          reviews={reviews}
          viewAs="public"
          emptyMessage={`${profile.display_name} hasn't received any reviews yet.`}
          emptyIcon="⭐"
        />
      </section>

      {/* Request Custom Order — Module 9 */}
      {profile.primary_category_id && (
        <div className="border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Request a Custom Order</h2>
          <p className="text-xs text-gray-500 mb-4">
            Need something made just for you? Describe your requirements and {profile.display_name} will provide a quote.
          </p>
          {user ? (
            <CustomOrderForm
              creatorId={profile.id}
              categoryId={profile.primary_category_id}
            />
          ) : (
            <div className="text-center py-3">
              <a
                href={`/login?redirected_from=/creators/${params.slug}`}
                className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
              >
                Sign in to request custom order
              </a>
            </div>
          )}
        </div>
      )}

      {/* Send Inquiry — Module 8 */}
      <div className="border-t border-gray-200 pt-6">
        {user ? (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Send an Inquiry</h2>
            <InquiryForm creatorId={profile.id} defaultInquiryType="general" />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Want to contact {profile.display_name}?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Sign in or create an account to send an inquiry.
            </p>
            <a
              href={`/login?redirected_from=/creators/${params.slug}`}
              className="inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Sign in to send inquiry
            </a>
          </div>
        )}
      </div>

      {/* Report Section — Module 14 */}
      <div className="mt-8 flex justify-center">
        {user ? (
          <ReportButton targetType="creator" targetId={profile.id} />
        ) : (
          <a
            href={`/login?redirected_from=/creators/${params.slug}`}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 underline transition"
          >
            Sign in to report this creator
          </a>
        )}
      </div>
    </main>
  );
}
