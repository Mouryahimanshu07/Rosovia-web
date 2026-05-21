import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { searchCreatorsForPublicPage, listActiveCategories } from '@rosovia/api';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { FilterPanel } from '~/components/search/filter-panel';
import { SearchBar } from '~/components/search/search-bar';
import { Pagination } from '~/components/search/pagination';
import { ActiveFilters } from '~/components/search/active-filters';

export const metadata: Metadata = {
  title: 'Creators — Rosovia',
  description: 'Discover verified creators, artisans, coders, designers, and skilled professionals on Rosovia.',
};

interface CreatorsPageProps {
  searchParams: Record<string, string | undefined>;
}

const CREATOR_FILTER_KEYS = [
  'q', 'category', 'city', 'state', 'verifiedOnly', 'sort',
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'rating_high', label: 'Top Rated' },
  { value: 'verified_first', label: 'Verified First' },
];

export default async function CreatorsPage({ searchParams }: CreatorsPageProps) {
  const supabase = createWebServerClient();
  const sp = searchParams as Record<string, string | string[] | undefined>;

  const [result, categories] = await Promise.all([
    searchCreatorsForPublicPage(supabase, sp),
    listActiveCategories(supabase),
  ]);

  const q = searchParams.q ?? '';
  const sort = searchParams.sort ?? 'newest';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Discover Creators</h1>
          <p className="text-gray-500 mb-5">
            Verified artisans, coders, designers, and skilled professionals.
          </p>
          <Suspense>
            <SearchBar action="/creators" defaultValue={q} placeholder="Search creators…" />
          </Suspense>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FilterPanel
            mode="creators"
            basePath="/creators"
            currentParams={sp}
            categories={categories}
          />
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Sort + count row */}
          <form method="GET" action="/creators" className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {CREATOR_FILTER_KEYS.filter((k) => k !== 'sort' && sp[k]).map((k) => (
              <input key={k} type="hidden" name={k} value={sp[k] as string} />
            ))}
            <div className="text-sm text-gray-500">
              {result.meta.total !== null
                ? `${result.meta.total.toLocaleString()} creator${result.meta.total !== 1 ? 's' : ''}`
                : `Page ${result.meta.page}`}
              {q && ` matching "${q}"`}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="creators-sort" className="text-sm text-gray-500">Sort:</label>
              <select
                id="creators-sort"
                name="sort"
                defaultValue={sort}
                onChange={(e) => { const f = e.currentTarget.closest('form'); if (f) f.requestSubmit(); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <noscript>
                <button type="submit" className="text-sm text-indigo-600">Apply</button>
              </noscript>
            </div>
          </form>

          <ActiveFilters
            searchParams={sp}
            basePath="/creators"
            filterKeys={CREATOR_FILTER_KEYS}
          />

          {result.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
              <p className="text-gray-400 text-lg font-medium">No creators found</p>
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {result.data.map((profile) => (
                <CreatorProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}

          <Pagination
            page={result.meta.page}
            hasNext={result.meta.hasNext}
            hasPrev={result.meta.hasPrev}
            total={result.meta.total}
            searchParams={sp}
            basePath="/creators"
          />
        </div>
      </div>
    </div>
  );
}
