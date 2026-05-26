'use client';

// apps/web/src/app/dashboard/buyer/saved/saved-dashboard-client.tsx

import { useState } from 'react';
import type { SavedListingWithDetails, SavedCreatorWithDetails } from '@rosovia/core';
import { ListingCard } from '~/components/listing/listing-card';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { SaveButton } from '~/components/saved/save-button';
import { Search, Heart, Bookmark, Compass } from 'lucide-react';

interface SavedDashboardClientProps {
  initialListings: SavedListingWithDetails[];
  initialCreators: SavedCreatorWithDetails[];
}

export function SavedDashboardClient({
  initialListings,
  initialCreators,
}: SavedDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'listings' | 'creators'>('listings');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter listings based on search query
  const filteredListings = initialListings.filter((item) => {
    if (!item.listings) return false;
    const q = searchQuery.toLowerCase();
    return (
      item.listings.title.toLowerCase().includes(q) ||
      (item.listings.creator_display_name &&
        item.listings.creator_display_name.toLowerCase().includes(q)) ||
      (item.listings.category_name &&
        item.listings.category_name.toLowerCase().includes(q)) ||
      (item.listings.description &&
        item.listings.description.toLowerCase().includes(q))
    );
  });

  // Filter creators based on search query
  const filteredCreators = initialCreators.filter((item) => {
    if (!item.creator_profiles) return false;
    const q = searchQuery.toLowerCase();
    return (
      item.creator_profiles.display_name.toLowerCase().includes(q) ||
      (item.creator_profiles.category_name &&
        item.creator_profiles.category_name.toLowerCase().includes(q)) ||
      (item.creator_profiles.bio &&
        item.creator_profiles.bio.toLowerCase().includes(q))
    );
  });

  const hasListings = initialListings.length > 0;
  const hasCreators = initialCreators.length > 0;

  return (
    <div className="space-y-6">
      {/* Search and Tabs Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        {/* Dual Tab Switcher */}
        <div className="flex p-1 bg-gray-100/80 rounded-xl max-w-xs">
          <button
            onClick={() => {
              setActiveTab('listings');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
              activeTab === 'listings'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Listings</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'listings'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {initialListings.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('creators');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
              activeTab === 'creators'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Creators</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'creators'
                  ? 'bg-rose-50 text-rose-700 font-bold'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {initialCreators.length}
            </span>
          </button>
        </div>

        {/* Live Search Bar */}
        {(activeTab === 'listings' ? hasListings : hasCreators) && (
          <div className="relative flex-1 max-w-sm sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder={`Search saved ${activeTab}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white/70 backdrop-blur-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
            />
          </div>
        )}
      </div>

      {/* Grid Content */}
      {activeTab === 'listings' ? (
        !hasListings ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 p-12 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 mb-4">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No saved listings</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Bookmark listings you are interested in while exploring the marketplace.
            </p>
            <div className="mt-6">
              <a
                href="/listings"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm active:scale-95 transition-all"
              >
                <Compass className="w-4 h-4" />
                Explore Listings
              </a>
            </div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="text-sm font-medium">No saved listings match &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredListings.map((item) => (
              <div key={item.id} className="relative group">
                <ListingCard listing={item.listings} />
                <div className="absolute top-3 right-3 z-10 transition-transform duration-300 group-hover:scale-105">
                  <SaveButton
                    targetType="listing"
                    targetId={item.listings.id}
                    initialSaved={true}
                    className="shadow-md hover:shadow-indigo-100"
                  />
                </div>
              </div>
            ))}
          </div>
        )
      ) : !hasCreators ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 p-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-4">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No saved creators</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Save creator profiles to stay updated with their listings, services, and portfolio updates.
          </p>
          <div className="mt-6">
            <a
              href="/creators"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 shadow-sm active:scale-95 transition-all"
            >
              <Compass className="w-4 h-4" />
              Find Creators
            </a>
          </div>
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-sm font-medium">No saved creators match &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCreators.map((item) => (
            <div key={item.id} className="relative group">
              <CreatorProfileCard profile={item.creator_profiles} />
              <div className="absolute top-3 right-3 z-10 transition-transform duration-300 group-hover:scale-105">
                <SaveButton
                  targetType="creator"
                  targetId={item.creator_profiles.id}
                  initialSaved={true}
                  className="shadow-md hover:shadow-rose-100"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
