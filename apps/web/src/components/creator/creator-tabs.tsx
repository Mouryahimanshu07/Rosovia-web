'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { CreatorProfileWithCategory, ListingWithDetails, MediaAsset, ReviewWithDetails, CollectionWithItems } from '@rosovia/core';
import { RatingSummary } from './rating-summary';
import { ListingCard } from '../listing/listing-card';
import { ReviewList } from '../review/review-list';
import { InquiryForm } from '../inquiry/inquiry-form';
import { CustomOrderForm } from '../custom-order/custom-order-form';
import { ReportButton } from '../report/report-button';

interface CreatorTabsProps {
  profile: CreatorProfileWithCategory;
  services: ListingWithDetails[];
  shop: ListingWithDetails[];
  portfolioListings: ListingWithDetails[];
  portfolioMedia: MediaAsset[];
  reviews: ReviewWithDetails[];
  user: any;
  collections?: CollectionWithItems[];
}

type TabType = 'about' | 'collections' | 'services' | 'shop' | 'portfolio' | 'reviews';

export function CreatorTabs({
  profile,
  services,
  shop,
  portfolioListings,
  portfolioMedia,
  reviews,
  user,
  collections = [],
}: CreatorTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('about');

  // Count items for badges
  const servicesCount = services.length;
  const shopCount = shop.length;
  const portfolioCount = portfolioListings.length + portfolioMedia.length;
  const reviewsCount = reviews.length;

  // Calculate rating breakdown
  const ratingDistribution = [0, 0, 0, 0, 0]; // Index 0 = 1 star, 4 = 5 stars
  reviews.forEach((r) => {
    const star = Math.max(1, Math.min(5, Math.round(r.rating)));
    const idx = star - 1;
    const currentVal = ratingDistribution[idx];
    if (typeof currentVal === 'number') {
      ratingDistribution[idx] = currentVal + 1;
    }
  });

  const tabClass = (tab: TabType) =>
    `flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 whitespace-nowrap cursor-pointer ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="space-y-8">
      {/* Premium Navigation Bar */}
      <div className="border-b border-gray-200 overflow-x-auto scrollbar-none">
        <nav className="flex space-x-8 px-1" aria-label="Tabs">
          <button onClick={() => setActiveTab('about')} className={tabClass('about')}>
            <span>About</span>
          </button>

          <button onClick={() => setActiveTab('collections')} className={tabClass('collections')}>
            <span>Showcases</span>
            {collections.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'collections' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-900'
              }`}>
                {collections.length}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('services')} className={tabClass('services')}>
            <span>Services</span>
            {servicesCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'services' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-900'
              }`}>
                {servicesCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('shop')} className={tabClass('shop')}>
            <span>Shop</span>
            {shopCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'shop' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-900'
              }`}>
                {shopCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('portfolio')} className={tabClass('portfolio')}>
            <span>Portfolio</span>
            {portfolioCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'portfolio' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-900'
              }`}>
                {portfolioCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('reviews')} className={tabClass('reviews')}>
            <span>Reviews</span>
            {reviewsCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'reviews' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-900'
              }`}>
                {reviewsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-300">
        {/* ABOUT PANEL */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
            {/* Bio & Story */}
            <div className="md:col-span-2 space-y-6">
              {profile.bio && (
                <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">About</h2>
                  <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">{profile.bio}</p>
                </section>
              )}

              {profile.story && (
                <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">My Story</h2>
                  <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">{profile.story}</p>
                </section>
              )}

              {/* Inquiry & Custom Order Forms */}
              <section className="space-y-6">
                {profile.primary_category_id && (
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-10 translate-y-10">
                      <svg width="240" height="240" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold mb-1">Request a Custom Order</h2>
                    <p className="text-xs text-indigo-100 mb-5">
                      Need something customized? Describe your requirements and {profile.display_name} will get back to you with a tailor-made offer.
                    </p>
                    {user ? (
                      <div className="bg-white rounded-xl p-5 text-gray-900 shadow-inner">
                        <CustomOrderForm
                          creatorId={profile.id}
                          categoryId={profile.primary_category_id}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <a
                          href={`/login?redirected_from=/creators/${profile.slug}`}
                          className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 shadow transition duration-300"
                        >
                          Sign in to Request Custom Order
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Send an Inquiry</h2>
                  <p className="text-xs text-gray-500 mb-5">
                    Have any questions regarding work, delivery times, or standard rates? Get in touch.
                  </p>
                  {user ? (
                    <InquiryForm creatorId={profile.id} defaultInquiryType="general" />
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-6 text-center border border-dashed border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Want to contact {profile.display_name}?
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        Sign in or create an account to start messaging.
                      </p>
                      <a
                        href={`/login?redirected_from=/creators/${profile.slug}`}
                        className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition duration-300"
                      >
                        Sign in to Contact Creator
                      </a>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar details */}
            <div className="space-y-6">
              {/* Skills & Info */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Skills</h3>
                  {profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No skills listed</p>
                  )}
                </div>

                <hr className="border-gray-100" />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Languages</h3>
                  {profile.languages.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.languages.map((lang) => (
                        <span
                          key={lang}
                          className="px-2.5 py-1 rounded-full bg-emerald-50/70 text-emerald-700 text-xs font-semibold border border-emerald-100"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No languages listed</p>
                  )}
                </div>

                <hr className="border-gray-100" />

                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400">Response Rate</h4>
                    <p className="text-sm font-bold text-gray-800">98% (Avg. 1 hr)</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400">Member Since</h4>
                    <p className="text-sm font-bold text-gray-800">
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Report button */}
              <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-inner">
                {user ? (
                  <ReportButton targetType="creator" targetId={profile.id} />
                ) : (
                  <a
                    href={`/login?redirected_from=/creators/${profile.slug}`}
                    className="text-xs font-medium text-gray-400 hover:text-gray-700 underline transition duration-300"
                  >
                    Sign in to report this creator
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHOWCASES PANEL */}
        {activeTab === 'collections' && (
          <div className="space-y-12 animate-fadeIn">
            {collections.length > 0 ? (
              <div className="space-y-10">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-gray-200/80 space-y-6"
                  >
                    {/* Decorative subtle background gradients */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-50/20 rounded-full blur-2xl pointer-events-none" />

                    {/* Collection Header */}
                    <div className="space-y-2 relative z-10">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-bold shadow-sm">
                          ✨
                        </span>
                        <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                          {collection.name}
                        </h3>
                      </div>
                      {collection.description && (
                        <p className="text-sm text-gray-500 max-w-2xl pl-11 leading-relaxed whitespace-pre-line">
                          {collection.description}
                        </p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-gray-100 via-gray-200 to-transparent pl-11" />

                    {/* Listings Grid */}
                    {collection.items.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                        {collection.items.map((item) => {
                          if (!item.listings) return null;
                          return (
                            <ListingCard
                              key={item.id}
                              listing={item.listings as ListingWithDetails}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200/60 pl-0 sm:pl-11">
                        <p className="text-xs font-semibold text-gray-400">
                          This showcase is currently empty.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  ✨
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No Showcases Yet</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  {profile.display_name} hasn&apos;t organized any collections or curated showcases yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* SERVICES PANEL */}
        {activeTab === 'services' && (
          <div className="animate-fadeIn">
            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  🛠️
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No Services Offered</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  {profile.display_name} has not listed any services, mentorships, or workshops yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* SHOP PANEL */}
        {activeTab === 'shop' && (
          <div className="animate-fadeIn">
            {shop.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {shop.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  🛍️
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">Shop is Empty</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  {profile.display_name} has not listed any shop items or digital products yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PORTFOLIO PANEL */}
        {activeTab === 'portfolio' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Show Portfolio Listings */}
            {portfolioListings.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-800">Featured Work Collections</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {portfolioListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </div>
            )}

            {/* Show General Portfolio Media Assets */}
            {portfolioMedia.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-800">Portfolio Gallery</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {portfolioMedia.map((media) => (
                    <div
                      key={media.id}
                      className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300 cursor-pointer aspect-square"
                    >
                      {media.public_url ? (
                        <div className="w-full h-full relative">
                          <Image
                            src={media.public_url}
                            alt={media.mime_type}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                          {/* Hover display details */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <div className="text-white">
                              <p className="text-xs uppercase font-bold tracking-widest text-indigo-300">
                                {media.media_type}
                              </p>
                              <p className="text-sm font-semibold truncate max-w-full">
                                {media.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50 text-sm">
                          Media file unreachable
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              portfolioListings.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    🎨
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">No Portfolio Showcase</h3>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">
                    {profile.display_name} has not uploaded any portfolio artwork, case studies, or design media yet.
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* REVIEWS PANEL */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-fadeIn">
            {reviews.length > 0 ? (
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-6">
                {/* Score Breakdown Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="text-center space-y-2">
                    <p className="text-5xl font-black text-gray-900">{profile.rating_avg.toFixed(1)}</p>
                    <RatingSummary avg={profile.rating_avg} count={profile.rating_count} className="justify-center" />
                    <p className="text-xs text-gray-400">Average rating on completed orders</p>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    {ratingDistribution.map((count, idx) => {
                      const percentage = reviewsCount > 0 ? (count / reviewsCount) * 100 : 0;
                      return (
                        <div key={idx} className="flex items-center text-sm">
                          <span className="w-8 font-semibold text-gray-600">{idx + 1} Star</span>
                          <div className="flex-1 h-2 mx-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-gray-400">{count}</span>
                        </div>
                      );
                    }).reverse()}
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="space-y-4">
                  <h3 className="text-base font-bold text-gray-800">Review Timeline ({reviewsCount})</h3>
                  <ReviewList
                    reviews={reviews}
                    viewAs="public"
                    emptyMessage={`${profile.display_name} hasn't received any reviews yet.`}
                    emptyIcon="⭐"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  ⭐
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No Reviews Yet</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  This creator has not completed any orders with reviews yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
