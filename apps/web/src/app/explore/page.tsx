import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getExplorePageData } from '@rosovia/api';
import { ListingCard } from '~/components/listing/listing-card';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { CategoryCard } from '~/components/category/category-card';
import { SearchBar } from '~/components/search/search-bar';

export const metadata: Metadata = {
  title: 'Explore — Rosovia',
  description: 'Discover verified creators, handmade products, services, mentorship, workshops, and more on Rosovia.',
};

interface ExplorePageProps {
  searchParams: Record<string, string | undefined>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const supabase = createWebServerClient();
  const { categories, listings, creators, q } = await getExplorePageData(
    supabase,
    searchParams as Record<string, string | string[] | undefined>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero / Search ─────────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-4 py-16 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-indigo-200 text-sm font-medium tracking-widest uppercase">
            Verified Talent-Commerce Marketplace
          </p>
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl">
            Discover what&apos;s possible
          </h1>
          <p className="text-indigo-100 md:text-lg">
            Browse verified creators, unique products, services, and learning opportunities.
          </p>
          <div className="flex justify-center pt-2">
            <Suspense>
              <SearchBar action="/explore" defaultValue={q} placeholder="Search creators, listings, categories…" />
            </Suspense>
          </div>
          {q && (
            <p className="text-indigo-200 text-sm mt-2">
              Showing results for <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span>
              {' '}—{' '}
              <Link href="/explore" className="underline hover:text-white">
                Clear
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 space-y-16">

        {/* ── Quick Category Links ───────────────────────────────────── */}
        {categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-900">Browse Categories</h2>
              <Link href="/categories" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {categories.slice(0, 10).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm"
                >
                  <span className="truncate">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Latest Approved Listings ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-gray-900">
              {q ? `Listings matching "${q}"` : 'Latest Listings'}
            </h2>
            <Link href={q ? `/listings?q=${encodeURIComponent(q)}` : '/listings'} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              View all →
            </Link>
          </div>

          {listings.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
              <p className="text-gray-400 text-lg font-medium">No listings found</p>
              {q && (
                <p className="text-gray-400 text-sm mt-1">
                  Try a different search or{' '}
                  <Link href="/listings" className="text-indigo-500 underline">
                    browse all listings
                  </Link>.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {listings.data.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>

        {/* ── Creator Discovery ──────────────────────────────────────── */}
        {!q && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-900">Meet Our Creators</h2>
              <Link href="/creators" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                View all →
              </Link>
            </div>

            {creators.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
                <p className="text-gray-400 text-lg font-medium">No creators yet</p>
                <p className="text-gray-400 text-sm mt-1">Check back soon as our community grows.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {creators.map((profile) => (
                  <CreatorProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Quick links row ────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { href: '/listings', title: 'All Listings', desc: 'Browse every approved product and service', emoji: '🏪' },
            { href: '/creators', title: 'All Creators', desc: 'Discover talented people on Rosovia', emoji: '🧑‍🎨' },
            { href: '/categories', title: 'All Categories', desc: 'Find exactly what you\'re looking for', emoji: '📂' },
          ].map(({ href, title, desc, emoji }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
            >
              <span className="text-3xl mb-3">{emoji}</span>
              <p className="font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </Link>
          ))}
        </section>

      </div>
    </div>
  );
}
