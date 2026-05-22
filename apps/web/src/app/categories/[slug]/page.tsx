import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
export const dynamic = 'force-dynamic';
// sort-select is a client component to handle onChange
import { createWebServerClient } from '~/lib/supabase/server';
import { getPublicCategoryDetailPageData } from '@rosovia/api';
import { ListingCard } from '~/components/listing/listing-card';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { SearchBar } from '~/components/search/search-bar';
import { FilterPanel } from '~/components/search/filter-panel';
import { Pagination } from '~/components/search/pagination';
import { ActiveFilters } from '~/components/search/active-filters';
import { SortSelect } from '~/components/search/sort-select';
import { listActiveCategories } from '@rosovia/api';

interface CategoryDetailPageProps {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}

export async function generateMetadata({ params }: CategoryDetailPageProps): Promise<Metadata> {
  const supabase = createWebServerClient();
  const result = await getPublicCategoryDetailPageData(supabase, params.slug);
  if (!result) {
    return { title: 'Category Not Found — Rosovia' };
  }
  return {
    title: `${result.category.name} — Rosovia`,
    description: result.category.description ?? `Browse ${result.category.name} on Rosovia.`,
  };
}

const LISTING_FILTER_KEYS = [
  'q', 'listingType', 'minPrice', 'maxPrice', 'city', 'state',
  'verifiedOnly', 'onlineAvailable', 'offlineAvailable', 'customOrderAvailable', 'sort',
];

const TYPE_LABELS: Record<string, string> = {
  product: 'Products', service: 'Services', learning: 'Learning',
  performance: 'Performance', mixed: 'Mixed',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low → High' },
  { value: 'price_high', label: 'Price: High → Low' },
];

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const supabase = createWebServerClient();
  const [result, allCategories] = await Promise.all([
    getPublicCategoryDetailPageData(
      supabase,
      params.slug,
      searchParams as Record<string, string | string[] | undefined>
    ),
    listActiveCategories(supabase),
  ]);

  if (!result) notFound();

  const { category, listings, creators } = result;
  const sp = searchParams as Record<string, string | string[] | undefined>;
  const basePath = `/categories/${params.slug}`;
  const sort = searchParams.sort ?? 'newest';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Category header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                category.type === 'product' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                category.type === 'service' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                category.type === 'learning' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                category.type === 'performance' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {TYPE_LABELS[category.type] ?? category.type}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-gray-500 max-w-2xl">{category.description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* ── Sidebar filter ──────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <FilterPanel
            mode="listings"
            basePath={basePath}
            currentParams={sp}
            categories={allCategories}
          />
        </aside>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* Listings section */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Listings{listings.meta.total !== null && ` (${listings.meta.total})`}
              </h2>
              <form method="GET" action={basePath} className="flex items-center gap-2">
                {/* Preserve current params as hidden fields */}
                {LISTING_FILTER_KEYS.filter((k) => k !== 'sort' && sp[k]).map((k) => (
                  <input key={k} type="hidden" name={k} value={sp[k] as string} />
                ))}
                <SortSelect
                  options={SORT_OPTIONS}
                  current={sort}
                />
              </form>
            </div>

            <div className="mb-4">
              <Suspense>
                <SearchBar action={basePath} defaultValue={searchParams.q ?? ''} placeholder="Search in this category…" />
              </Suspense>
            </div>

            <ActiveFilters
              searchParams={sp}
              basePath={basePath}
              filterKeys={LISTING_FILTER_KEYS}
            />

            {listings.data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
                <p className="text-gray-400 font-medium">No listings in this category yet.</p>
                <p className="text-gray-400 text-sm mt-1">Approved listings will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {listings.data.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            <Pagination
              page={listings.meta.page}
              hasNext={listings.meta.hasNext}
              hasPrev={listings.meta.hasPrev}
              total={listings.meta.total}
              searchParams={sp}
              basePath={basePath}
            />
          </section>

          {/* Creators section */}
          {creators.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-5">
                Creators in this category ({creators.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {creators.map((profile) => (
                  <CreatorProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
