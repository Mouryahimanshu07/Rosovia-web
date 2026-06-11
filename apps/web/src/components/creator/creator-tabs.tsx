'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { CreatorProfileWithCategory, ListingWithDetails, MediaAsset, ReviewWithDetails, CollectionWithItems, CreatorPostWithDetails } from '@rosovia/core';
import { RatingSummary } from './rating-summary';
import { ListingCard } from '../listing/listing-card';
import { ReviewList } from '../review/review-list';
import { InquiryForm } from '../inquiry/inquiry-form';
import { CustomOrderForm } from '../custom-order/custom-order-form';
import { CreatorPostGrid } from '../post/CreatorPostGrid';

interface CreatorTabsProps {
  profile: CreatorProfileWithCategory;
  services: ListingWithDetails[];
  shop: ListingWithDetails[];
  portfolioListings: ListingWithDetails[];
  portfolioMedia: MediaAsset[];
  reviews: ReviewWithDetails[];
  user: any;
  collections?: CollectionWithItems[];
  workPosts?: CreatorPostWithDetails[];
  isOwnProfile?: boolean;
  username?: string;
}

type TabType = 'portfolio' | 'posts' | 'services' | 'shop' | 'custom_order' | 'reviews';

export function CreatorTabs({
  profile,
  services,
  shop,
  portfolioListings,
  portfolioMedia,
  reviews,
  user,
  collections = [],
  workPosts = [],
  isOwnProfile = false,
  username,
}: CreatorTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('portfolio');
  const [activeMedia, setActiveMedia] = useState<MediaAsset | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Smooth anchor scrolling for custom order requests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleHash = () => {
        if (window.location.hash === '#custom-order-panel') {
          setActiveTab('custom_order');
          setShowRequestForm(true);
          setTimeout(() => {
            const el = document.getElementById('custom-order-panel');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      };
      handleHash();
      window.addEventListener('hashchange', handleHash);
      return () => window.removeEventListener('hashchange', handleHash);
    }
  }, []);

  // Count items for badges
  const servicesCount = services.length;
  const shopCount = shop.length;
  const portfolioCount = portfolioListings.length + portfolioMedia.length;
  const reviewsCount = reviews.length;
  const postsCount = workPosts.length;

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
    `flex items-center gap-1.5 py-4 px-1 border-b-2 font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-600 font-black'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const renderBadge = (count: number, tab: TabType) => (
    <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
      activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {count}
    </span>
  );

  return (
    <div className="space-y-8">
      {/* Navigation Bar (Horizontally scrollable on mobile, active tab underline) */}
      <div className="overflow-x-auto scrollbar-none bg-white rounded-2xl px-5 border border-gray-200 shadow-sm">
        <nav className="flex space-x-6 min-w-max" aria-label="Tabs">
          <button onClick={() => setActiveTab('portfolio')} className={tabClass('portfolio')}>
            <span>Portfolio</span>
            {portfolioCount > 0 && renderBadge(portfolioCount, 'portfolio')}
          </button>

          <button onClick={() => setActiveTab('posts')} className={tabClass('posts')}>
            <span>Posts</span>
            {postsCount > 0 && renderBadge(postsCount, 'posts')}
          </button>

          <button onClick={() => setActiveTab('services')} className={tabClass('services')}>
            <span>Services</span>
            {servicesCount > 0 && renderBadge(servicesCount, 'services')}
          </button>

          <button onClick={() => setActiveTab('shop')} className={tabClass('shop')}>
            <span>Shop</span>
            {shopCount > 0 && renderBadge(shopCount, 'shop')}
          </button>

          <button onClick={() => setActiveTab('custom_order')} className={tabClass('custom_order')}>
            <span>Custom Order</span>
          </button>

          <button onClick={() => setActiveTab('reviews')} className={tabClass('reviews')}>
            <span>Reviews</span>
            {reviewsCount > 0 && renderBadge(reviewsCount, 'reviews')}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-300">

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
            {(portfolioMedia.length > 0 || isOwnProfile) ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-800">Portfolio Gallery</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Add Portfolio CTA Card (Owner only) */}
                  {isOwnProfile && (
                    <Link
                      href="/dashboard/portfolio/new"
                      className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all duration-300 aspect-square p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-bold text-gray-800">Add Portfolio</span>
                      <span className="text-xs text-gray-400 mt-1">Showcase your best work</span>
                    </Link>
                  )}

                  {portfolioMedia.map((media) => {
                    const isVideo = media.media_type === 'video' || media.mime_type.startsWith('video/');
                    let displayTitle = media.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE';
                    if (media.alt_text) {
                      try {
                        const parsed = JSON.parse(media.alt_text);
                        if (parsed && parsed.title) {
                          displayTitle = parsed.title;
                        }
                      } catch {
                        displayTitle = media.alt_text;
                      }
                    }
                    return (
                      <div
                        key={media.id}
                        onClick={() => setActiveMedia(media)}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300 cursor-pointer aspect-square"
                      >
                        {media.public_url ? (
                          <div className="w-full h-full relative">
                            {isVideo ? (
                              <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                                {media.thumbnail_url ? (
                                  <Image
                                    src={media.thumbnail_url}
                                    alt={media.mime_type}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-955">
                                    <span className="text-4xl text-gray-700">🎥</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/25 transition-colors duration-300">
                                  <div className="w-10 h-10 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-gray-900 ml-0.5 text-xs">▶</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Image
                                src={media.public_url}
                                alt={media.mime_type}
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                                className="object-cover transition duration-500 group-hover:scale-105"
                                unoptimized
                              />
                            )}
                            
                            {/* Hover details overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                              <div className="text-white text-left w-full">
                                <p className="text-xs uppercase font-bold tracking-widest text-indigo-300">
                                  {media.media_type}
                                </p>
                                <p className="text-sm font-semibold truncate max-w-full">
                                  {displayTitle}
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
                    );
                  })}
                </div>
              </div>
            ) : (
              portfolioListings.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    🎨
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">
                    {isOwnProfile ? 'Show your best work. Add your first portfolio item.' : 'No portfolio items yet.'}
                  </h3>
                  <p className="text-sm text-gray-405 max-w-sm mx-auto mt-1">
                    {isOwnProfile
                      ? 'Create a listing or upload media to showcase your work collections to visitors.'
                      : `${profile.display_name} hasn't uploaded any portfolio collections or media assets yet.`}
                  </p>
                  {isOwnProfile && (
                    <div className="mt-4 flex gap-3 justify-center">
                      <a
                        href="/dashboard/creator/listings/new"
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        Create Listing
                      </a>
                      <a
                        href="/dashboard/portfolio/new"
                        className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                      >
                        Add Portfolio Item
                      </a>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* POSTS PANEL */}
        {activeTab === 'posts' && (
          <div className="animate-fadeIn">
            {workPosts.length > 0 ? (
              <CreatorPostGrid
                posts={workPosts}
                showCreator={false}
                emptyMessage={`${profile.display_name} hasn't shared any work posts yet.`}
              />
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  📷
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">
                  {isOwnProfile ? 'Share your latest work. Create your first post.' : 'No posts yet.'}
                </h3>
                <p className="text-sm text-gray-405 max-w-sm mx-auto mb-4">
                  {isOwnProfile
                    ? "Share behind-the-scenes, updates, or recent works with your followers."
                    : `${profile.display_name} hasn't shared any work posts yet.`}
                </p>
                {isOwnProfile && (
                  <Link
                    href={`/u/${username || profile.slug}/posts/new`}
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    Create Your First Post
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* SERVICES PANEL */}
        {activeTab === 'services' && (
          <div className="animate-fadeIn">
            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((listing) => {
                  const deliveryDays = (listing.metadata as any)?.deliveryDays;
                  return (
                    <div
                      key={listing.id}
                      className="group flex flex-col justify-between bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                    >
                      <div className="space-y-3">
                        {/* Category & Badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="capitalize px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-extrabold text-indigo-705 border border-indigo-100">
                            {listing.listing_type.replace('_', ' ')}
                          </span>
                          {listing.category_name && (
                            <span className="text-xs text-gray-450 font-semibold">{listing.category_name}</span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-extrabold text-gray-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2 text-left">
                          {listing.title}
                        </h4>

                        {/* Info Rows */}
                        <div className="space-y-1.5 pt-1 text-left">
                          {listing.price !== null ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="text-gray-500 font-medium">Starting at:</span>
                              <span className="font-extrabold text-gray-900">
                                {listing.currency} {listing.price.toLocaleString('en-IN')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs italic text-gray-500 font-medium">Price on request</span>
                          )}

                          {deliveryDays !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Delivered in {deliveryDays} day{deliveryDays > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action CTA Buttons */}
                      <div className="flex gap-2.5 mt-5 pt-3.5 border-t border-gray-100">
                        <Link
                          href={`/listings/${listing.slug}`}
                          className="flex-1 text-center py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition"
                        >
                          View Service
                        </Link>
                        {!isOwnProfile && (
                          user ? (
                            <a
                              href="#custom-order-panel"
                              onClick={() => {
                                setActiveTab('custom_order');
                                setShowRequestForm(true);
                              }}
                              className="flex-1 text-center py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                            >
                              Request Custom Order
                            </a>
                          ) : (
                            <Link
                              href={`/login?redirected_from=/u/${username || profile.slug}%23custom-order-panel`}
                              className="flex-1 text-center py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                            >
                              Request Custom Order
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  🛠️
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">
                  {isOwnProfile ? 'Add your first service.' : 'No services available yet.'}
                </h3>
                <p className="text-sm text-gray-405 max-w-sm mx-auto mt-1">
                  {isOwnProfile
                    ? 'Offer mentorships, consulting, customized services, or workshops.'
                    : `${profile.display_name} has not listed any services yet.`}
                </p>
                {isOwnProfile && (
                  <a
                    href="/dashboard/creator/listings/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    Add Service
                  </a>
                )}
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
                <h3 className="text-base font-bold text-gray-800 mb-1">
                  {isOwnProfile ? 'Add your first product.' : 'No products available yet.'}
                </h3>
                <p className="text-sm text-gray-405 max-w-sm mx-auto mt-1">
                  {isOwnProfile
                    ? 'Sell digital assets, physical artwork, or downloadable resources.'
                    : `${profile.display_name} has not listed any products yet.`}
                </p>
                {isOwnProfile && (
                  <a
                    href="/dashboard/creator/listings/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    Add Product
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* CUSTOM ORDER PANEL */}
        {activeTab === 'custom_order' && (() => {
          const hasCategory = !!profile.primary_category_id;
          const acceptsCustomOrders = hasCategory && (profile.accepts_custom_orders !== false);

          return (
            <div className="space-y-8 animate-fadeIn" id="custom-order-panel">
              {isOwnProfile ? (
                // Owner View
                !acceptsCustomOrders ? (
                  // Owner, but custom orders disabled (either category is missing or accepts_custom_orders is false)
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl">
                      🚫
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">You are not accepting custom orders right now.</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      {!hasCategory 
                        ? 'Select a primary category in your profile settings to enable custom orders.' 
                        : 'Enable custom orders in your settings to allow buyers to request custom work.'}
                    </p>
                    <Link
                      href={`/u/${username || profile.slug}/edit`}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                      {!hasCategory ? 'Select Category' : 'Enable Custom Orders'}
                    </Link>
                  </div>
                ) : (
                  // Owner and custom orders enabled
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm text-left space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                        ⚙️
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Custom Order Settings</h3>
                        <p className="text-xs text-gray-500">Tell buyers what type of custom work you accept.</p>
                      </div>
                    </div>

                    {/* Display Settings info if present */}
                    {(profile.custom_order_description || profile.custom_order_starting_price || profile.custom_order_delivery_days) && (
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-sm text-gray-600 space-y-3">
                        {profile.custom_order_description && (
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Custom Work Policy</p>
                            <p className="mt-1 font-medium text-gray-700 whitespace-pre-line">{profile.custom_order_description}</p>
                          </div>
                        )}
                        <div className="flex gap-6 flex-wrap pt-2 border-t border-gray-200/60">
                          {profile.custom_order_starting_price !== null && (
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Starting Price</p>
                              <p className="mt-0.5 font-bold text-gray-950">₹{Number(profile.custom_order_starting_price).toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          {profile.custom_order_delivery_days !== null && (
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivery Time</p>
                              <p className="mt-0.5 font-bold text-gray-950">{profile.custom_order_delivery_days} Days</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Link
                        href={`/u/${username || profile.slug}/edit`}
                        className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-sm transition"
                      >
                        Edit Custom Order Info
                      </Link>
                      <Link
                        href="/dashboard/creator/custom-orders"
                        className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition"
                      >
                        View Custom Requests
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                // Visitor View (authenticated or anonymous)
                !acceptsCustomOrders ? (
                  // Visitor, and custom orders disabled
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto text-2xl">
                      🚫
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">This creator is not accepting custom orders right now.</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      You can still browse their Portfolio or message them directly.
                    </p>
                    <button
                      disabled
                      className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-6 py-2.5 text-xs font-bold text-gray-400 cursor-not-allowed border border-gray-200"
                    >
                      Request Custom Order
                    </button>
                  </div>
                ) : (
                  // Visitor, and custom orders enabled
                  <div className="space-y-6">
                    {showRequestForm && user ? (
                      // Display CustomOrderForm directly if showRequestForm is true and logged in
                      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm text-left space-y-5">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                          <div>
                            <h3 className="text-lg font-black text-gray-900">Request a Custom Order</h3>
                            <p className="text-xs text-gray-400">Describe your project requirements to get a custom quote.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowRequestForm(false)}
                            className="text-xs font-bold text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                          >
                            ← Back
                          </button>
                        </div>
                        <CustomOrderForm
                          creatorId={profile.id}
                          categoryId={profile.primary_category_id!}
                        />
                      </div>
                    ) : (
                      // Otherwise display the "Request a Custom Order" landing card
                      <div className="bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-150/30 text-left">
                        {/* Decorative Vector Graphic */}
                        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
                          <svg width="240" height="240" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>

                        <div className="max-w-xl space-y-2 mb-6">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-[10px] font-extrabold uppercase tracking-widest text-indigo-200">
                            ⚡ Customized Commission
                          </span>
                          <h2 className="text-2xl font-black tracking-tight">Request a Custom Order</h2>
                          <p className="text-xs text-indigo-105 leading-relaxed">
                            Describe what you need and get a custom quote from this creator. Personalized finishing, custom sizes, and custom timelines are supported.
                          </p>
                        </div>

                        {/* Display Settings/starting budget/time if present */}
                        {(profile.custom_order_description || profile.custom_order_starting_price || profile.custom_order_delivery_days) && (
                          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-xs text-indigo-100 space-y-3 mb-6 max-w-2xl">
                            {profile.custom_order_description && (
                              <div>
                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Custom Work Policy & Services</p>
                                <p className="mt-1 font-medium whitespace-pre-line text-white">{profile.custom_order_description}</p>
                              </div>
                            )}
                            <div className="flex gap-6 flex-wrap pt-2 border-t border-white/10">
                              {profile.custom_order_starting_price !== null && (
                                <div>
                                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Starting Budget</p>
                                  <p className="mt-0.5 font-black text-white text-sm">₹{Number(profile.custom_order_starting_price).toLocaleString('en-IN')}</p>
                                </div>
                              )}
                              {profile.custom_order_delivery_days !== null && (
                                <div>
                                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Typical Delivery</p>
                                  <p className="mt-0.5 font-black text-white text-sm">{profile.custom_order_delivery_days} Days</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3 items-center">
                          {user ? (
                            <button
                              type="button"
                              onClick={() => setShowRequestForm(true)}
                              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-black text-indigo-600 hover:bg-indigo-50 shadow-md transition-all active:scale-95 duration-150"
                            >
                              Request Custom Order
                            </button>
                          ) : (
                            <Link
                              href={`/login?redirected_from=/u/${username || profile.slug}%23custom-order-panel`}
                              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-black text-indigo-600 hover:bg-indigo-50 shadow-md transition-all active:scale-95 duration-150"
                            >
                              Request Custom Order
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Inquiry Form */}
              {!isOwnProfile && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md text-left">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full blur-2xl pointer-events-none" />
                  <h2 className="text-lg font-black text-gray-900 tracking-tight mb-2">Send an Inquiry</h2>
                  <p className="text-xs text-gray-550 mb-6 leading-relaxed">
                    Have a quick question about custom availability, work licensing, or delivery timelines? Write directly to the creator.
                  </p>
                  {user ? (
                    <InquiryForm creatorId={profile.id} defaultInquiryType="general" />
                  ) : (
                    <div className="bg-slate-50/50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        Have a project question?
                      </p>
                      <p className="text-xs text-gray-405 mb-5 max-w-sm mx-auto">
                        Inquiries and messages are fully verified and safe. Authenticate now to begin talking.
                      </p>
                      <a
                        href={`/login?redirected_from=/creators/${profile.slug}`}
                        className="inline-flex items-center rounded-full bg-gray-900 px-6 py-2.5 text-xs font-black text-white hover:bg-gray-800 shadow transition duration-300 active:scale-95"
                      >
                        Sign in to Contact Creator
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

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
                  <h3 className="text-base font-bold text-gray-800 text-left">Review Timeline ({reviewsCount})</h3>
                  <ReviewList
                    reviews={reviews}
                    viewAs="public"
                    emptyMessage="No reviews yet."
                    emptyIcon="⭐"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  ⭐
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No reviews yet.</h3>
                <p className="text-sm text-gray-405 max-w-sm mx-auto">
                  This creator has not completed any orders with reviews yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Portfolio Media Assets */}
      {activeMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-6 animate-fadeIn">
          {/* Close button */}
          <button
            onClick={() => setActiveMedia(null)}
            className="absolute top-4 right-4 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all z-50 border border-white/10 shadow-lg"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Lightbox Card Container */}
          <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col md:flex-row max-h-[85vh] md:max-h-[80vh]">
            {/* Left: Media Area */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[450px] relative">
              {activeMedia.public_url ? (
                activeMedia.media_type === 'video' || activeMedia.mime_type.startsWith('video/') ? (
                  <video
                    src={activeMedia.public_url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[45vh] md:max-h-[75vh] object-contain"
                  />
                ) : (
                  <div className="w-full h-full min-h-[300px] md:min-h-[450px] relative">
                    <Image
                      src={activeMedia.public_url}
                      alt="Portfolio asset view"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                )
              ) : (
                <div className="w-full h-full min-h-[300px] md:min-h-[450px] flex items-center justify-center bg-gray-900 text-white/50 text-6xl">
                  🎨
                </div>
              )}
            </div>

            {/* Right: Info Sidebar */}
            <div className="w-full md:w-80 bg-white p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 overflow-y-auto">
              <div className="space-y-4">
                {/* Creator Profile Info */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 overflow-hidden flex-shrink-0 relative">
                    {profile.profile_image_url ? (
                      <Image
                        src={profile.profile_image_url}
                        alt={profile.display_name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-indigo-400">
                        {profile.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {profile.display_name}
                    </p>
                    {profile.profile_username && (
                      <p className="text-xs text-gray-400 font-semibold">@{profile.profile_username}</p>
                    )}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {(() => {
                  let title = '';
                  let description = '';
                  if (activeMedia.alt_text) {
                    try {
                      const parsed = JSON.parse(activeMedia.alt_text);
                      if (parsed && typeof parsed === 'object') {
                        title = parsed.title || '';
                        description = parsed.description || '';
                      }
                    } catch (e) {
                      title = activeMedia.alt_text;
                    }
                  }

                  return (
                    <>
                      {title && (
                        <div className="space-y-1 text-left">
                          <p className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">Title</p>
                          <h4 className="text-sm font-bold text-gray-900 leading-snug">{title}</h4>
                        </div>
                      )}
                      {description && (
                        <div className="space-y-1 text-left">
                          <p className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">Description</p>
                          <p className="text-xs text-gray-600 leading-relaxed font-semibold whitespace-pre-wrap">{description}</p>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="space-y-1 text-left">
                  <p className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">File Details</p>
                  <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                    Type: {activeMedia.mime_type.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="space-y-4 pt-4 border-t border-gray-100 mt-6 shrink-0">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMedia(null)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold text-center transition"
                  >
                    Close
                  </button>
                  {!isOwnProfile && (
                    <a
                      href="#custom-order-panel"
                      onClick={() => {
                        setActiveMedia(null);
                        setActiveTab('custom_order');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition shadow-sm"
                    >
                      Commission
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
