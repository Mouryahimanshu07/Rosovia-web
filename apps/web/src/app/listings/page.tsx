import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { searchListingsForPublicPage, listActiveCategories } from '@rosovia/api';
import { ListingCard } from '~/components/listing/listing-card';
import { FilterPanel } from '~/components/search/filter-panel';
import { SearchBar } from '~/components/search/search-bar';
import { Pagination } from '~/components/search/pagination';
import { ActiveFilters } from '~/components/search/active-filters';
import { SortSelect } from '~/components/search/sort-select';

export const metadata: Metadata = {
  title: 'Listings — Rosovia',
  description: 'Browse verified products, services, mentorship, workshops, and more on Rosovia.',
};

interface ListingsPageProps {
  searchParams: Record<string, string | undefined>;
}

const LISTING_FILTER_KEYS = [
  'q', 'category', 'listingType', 'minPrice', 'maxPrice', 'city', 'state',
  'verifiedOnly', 'customOrderAvailable', 'onlineAvailable', 'offlineAvailable', 'sort',
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low → High' },
  { value: 'price_high', label: 'Price: High → Low' },
];

export default async function PublicListingsPage({ searchParams }: ListingsPageProps) {
  const supabase = createWebServerClient();
  const sp = searchParams as Record<string, string | string[] | undefined>;

  const [result, categories] = await Promise.all([
    searchListingsForPublicPage(supabase, sp),
    listActiveCategories(supabase),
  ]);

  const q = searchParams.q ?? '';
  const sort = searchParams.sort ?? 'newest';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Browse Listings</h1>
          <p className="text-gray-500 mb-5">
            Products, services, mentorships, and more from verified creators.
          </p>
          <Suspense>
            <SearchBar action="/listings" defaultValue={q} placeholder="Search listings…" />
          </Suspense>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FilterPanel
            mode="listings"
            basePath="/listings"
            currentParams={sp}
            categories={categories}
          />
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Sort + count row */}
          <form method="GET" action="/listings" className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {/* Preserve all current filters as hidden inputs */}
            {LISTING_FILTER_KEYS.filter((k) => k !== 'sort' && sp[k]).map((k) => (
              <input key={k} type="hidden" name={k} value={sp[k] as string} />
            ))}
            <div className="text-sm text-gray-500">
              {result.meta.total !== null
                ? `${result.meta.total.toLocaleString()} listing${result.meta.total !== 1 ? 's' : ''}`
                : `Page ${result.meta.page}`}
              {q && ` for "${q}"`}
            </div>
            <SortSelect
              options={SORT_OPTIONS}
              current={sort}
            />
          </form>

          <ActiveFilters
            searchParams={sp}
            basePath="/listings"
            filterKeys={LISTING_FILTER_KEYS}
          />

          {result.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
              <p className="text-gray-400 text-lg font-medium">No listings found</p>
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {result.data.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          <Pagination
            page={result.meta.page}
            hasNext={result.meta.hasNext}
            hasPrev={result.meta.hasPrev}
            total={result.meta.total}
            searchParams={sp}
            basePath="/listings"
          />
        </div>
      </div>
    </div>
  );
}
