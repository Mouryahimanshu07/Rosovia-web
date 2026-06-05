import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  getPublicListingBySlug,
  listReviewsForPublicListing,
  isListingSavedForUser,
} from '@rosovia/api';
import { SaveButton } from '~/components/saved/save-button';
import { ListingTypeBadge } from '~/components/listing/listing-type-badge';
import { ListingMetadataView } from '~/components/listing/listing-metadata-view';
import { InquiryForm } from '~/components/inquiry/inquiry-form';
import { CustomOrderForm } from '~/components/custom-order/custom-order-form';
import { CreateListingOrderButton } from '~/components/order/create-listing-order-button';
import { ReviewList } from '~/components/review/review-list';
import { ReportButton } from '~/components/report/report-button';
import { VerificationBadge } from '~/components/creator/verification-badge';
import type { InquiryType, ListingType } from '@rosovia/core';

interface Props {
  params: { slug: string };
}

/** Map listing type to the most appropriate inquiry type. */
function defaultInquiryTypeForListing(listingType: ListingType): InquiryType {
  switch (listingType) {
    case 'product':
      return 'product';
    case 'service':
      return 'service';
    case 'mentorship':
      return 'mentorship';
    default:
      return 'general';
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createWebServerClient();
  const listing = await getPublicListingBySlug(supabase, params.slug);
  if (!listing) return { title: 'Listing not found — Rosovia' };
  return {
    title: `${listing.title} — Rosovia`,
    description: listing.description ?? `${listing.title} on Rosovia by ${listing.creator_display_name ?? 'a Rosovia creator'}.`,
  };
}

export default async function PublicListingDetailPage({ params }: Props) {
  const supabase = createWebServerClient();
  const listing = await getPublicListingBySlug(supabase, params.slug);

  if (!listing) notFound();

  const reviews = await listReviewsForPublicListing(supabase, listing.id);

  const location = [listing.city, listing.state].filter(Boolean).join(', ');

  // Check auth state for inquiry and custom order sections
  const { data: { user } } = await supabase.auth.getUser();

  const initialSaved = user ? await isListingSavedForUser(supabase, listing.id) : false;

  const inquiryType = defaultInquiryTypeForListing(listing.listing_type);
  const loginRedirect = `/login?redirected_from=/listings/${params.slug}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Payment explanation banner */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 mb-6 flex items-start gap-3">
        <span className="text-xl">💳</span>
        <div>
          <p className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
            Direct Commission & Custom Orders Active (Payments Disabled)
          </p>
          <p className="text-xs text-indigo-900 mt-1 leading-relaxed">
            Online checkout is temporarily paused as we finalize our integrated talent-commerce escrow gateways. You can safely collaborate and transact by messaging the creator directly or requesting a **Custom Order** below to arrange custom milestones.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <ListingTypeBadge type={listing.listing_type} />
          {listing.category_name && (
            <span className="text-sm text-gray-500">{listing.category_name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{listing.title}</h1>
          {user && (
            <SaveButton
              targetType="listing"
              targetId={listing.id}
              initialSaved={initialSaved}
            />
          )}
        </div>
        {listing.creator_display_name && (
          <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-gray-500">
            <span>by</span>
            {listing.creator_slug ? (
              <Link href={`/creators/${listing.creator_slug}`} className="font-semibold text-indigo-600 hover:underline">
                {listing.creator_display_name}
              </Link>
            ) : (
              <span className="font-semibold text-gray-800">{listing.creator_display_name}</span>
            )}
            {listing.creator_verification_level && listing.creator_verification_level !== 'none' && (
              <VerificationBadge level={listing.creator_verification_level} className="scale-90 transform origin-left shadow-sm" />
            )}
            {listing.creator_rating_count && listing.creator_rating_count > 0 ? (
              <span className="text-xs text-gray-400 flex items-center gap-1 ml-1 border-l pl-2 border-gray-200">
                <span className="text-amber-500">★</span>
                <span className="font-medium text-gray-700">{listing.creator_rating_avg?.toFixed(1)}</span>
                <span>({listing.creator_rating_count} reviews)</span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Cover image placeholder */}
      <div className="w-full h-52 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-sm mb-8">
        Images coming in Module 6
      </div>

      {/* Price block */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          {listing.price !== null ? (
            <p className="text-2xl font-bold text-gray-900">
              {listing.currency} {listing.price.toLocaleString('en-IN')}
            </p>
          ) : (
            <p className="text-lg text-gray-500 italic">Price on request</p>
          )}
          {location && <p className="text-sm text-gray-400 mt-1">{location}</p>}
        </div>

        {/* Availability pills */}
        <div className="flex flex-wrap gap-2">
          {listing.online_available && (
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs">Online</span>
          )}
          {listing.offline_available && (
            <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs">In-Person</span>
          )}
          {listing.delivery_available && (
            <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs">Delivery</span>
          )}
          {listing.custom_order_available && (
            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs">Custom Orders</span>
          )}
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">About this listing</h2>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
        </section>
      )}

      {/* Metadata */}
      {Object.keys(listing.metadata).length > 0 && (
        <div className="mb-6">
          <ListingMetadataView metadata={listing.metadata} />
        </div>
      )}

      {/* Buy / Book — Module 10 */}
      <div className="border-t border-gray-200 pt-6 mb-4">
        {listing.price !== null ? (
          user ? (
            <div className="flex items-center gap-3 flex-wrap">
              <CreateListingOrderButton listingId={listing.id} />
              <p className="text-xs text-gray-400">
                Creates an order. Payment will be added in a future update.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={loginRedirect}
                className="inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition"
              >
                Sign in to Request Purchase
              </a>
            </div>
          )
        ) : (
          <p className="text-sm text-gray-500 italic">
            This listing does not have a fixed price. Send an inquiry below.
          </p>
        )}
      </div>

      {/* Custom Order Request — Module 9 (only if listing has custom_order_available) */}
      {listing.custom_order_available && listing.category_id && (
        <div className="border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Request a Custom Order</h2>
          <p className="text-xs text-gray-500 mb-4">
            Need something specific? Describe your requirements and the creator will provide a quote.
          </p>
          {user ? (
            <CustomOrderForm
              creatorId={listing.creator_id}
              listingId={listing.id}
              categoryId={listing.category_id}
              defaultTitle={`Custom order based on: ${listing.title}`}
            />
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-3">
                Sign in to request a custom order.
              </p>
              <a
                href={loginRedirect}
                className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
              >
                Sign in to request custom order
              </a>
            </div>
          )}
        </div>
      )}

      {/* Send Inquiry — Module 8 */}
      <div className="border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Send an Inquiry</h2>
        <p className="text-xs text-gray-500 mb-4">
          Ask the creator about this listing before purchasing.
        </p>
        {user ? (
          <InquiryForm
            creatorId={listing.creator_id}
            listingId={listing.id}
            defaultInquiryType={inquiryType}
          />
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-3">
              Sign in to send an inquiry about this listing.
            </p>
            <a
              href={loginRedirect}
              className="inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Sign in to send inquiry
            </a>
          </div>
        )}
      </div>

      {/* Reviews Section — Module 12 */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Reviews ({reviews.length})
        </h2>
        <ReviewList
          reviews={reviews}
          viewAs="public"
          emptyMessage="No reviews for this listing yet. Be the first to review after purchasing."
          emptyIcon="⭐"
        />
      </section>

      {/* Report Section — Module 14 */}
      <div className="mt-8 flex justify-center">
        {user ? (
          <ReportButton targetType="listing" targetId={listing.id} />
        ) : (
          <a
            href={`/login?redirected_from=/listings/${params.slug}`}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 underline transition"
          >
            Sign in to report this listing
          </a>
        )}
      </div>
    </main>
  );
}
