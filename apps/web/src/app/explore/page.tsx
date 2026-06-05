import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getExplorePageData, searchApprovedListings } from '@rosovia/api';
import { ListingCard } from '~/components/listing/listing-card';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { SearchBar } from '~/components/search/search-bar';
import { CreatorPostGrid } from '~/components/post/CreatorPostGrid';
import { LayoutGrid, ShoppingBag, Wrench, FolderOpen, User, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Explore — Rosovia',
  description:
    'Discover verified creators, handmade products, services, mentorship, and real creator work on Rosovia — India\'s creator marketplace.',
};

interface ExplorePageProps {
  searchParams: Record<string, string | undefined>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const supabase = createWebServerClient();
  const { categories, creators, workFeed, q } = await getExplorePageData(
    supabase,
    searchParams as Record<string, string | string[] | undefined>
  );

  const activeTab = searchParams.tab ?? 'work';
  const page = searchParams.page ? parseInt(searchParams.page) : 1;

  // Dynamically fetch products/services listings depending on the active tab
  let products = null;
  let services = null;

  if (activeTab === 'products') {
    products = await searchApprovedListings(supabase, {
      q,
      listingType: 'product',
      page,
    });
  } else if (activeTab === 'services') {
    services = await searchApprovedListings(supabase, {
      q,
      listingType: 'service',
      page,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ── Hero / Search ─────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 px-4 py-16 text-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/30 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-3xl space-y-4 relative">
          <p className="text-indigo-200 text-sm font-medium tracking-widest uppercase">
            Verified Talent-Commerce Marketplace
          </p>
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl leading-tight">
            Discover what&apos;s possible
          </h1>
          <p className="text-indigo-100 md:text-lg">
            Browse verified creators, unique products, services, and real creator work.
          </p>
          <div className="flex justify-center pt-2">
            <Suspense>
              <SearchBar
                action="/explore"
                defaultValue={q}
                placeholder="Search creators, listings, categories…"
              />
            </Suspense>
          </div>
          {q && (
            <p className="text-indigo-200 text-sm mt-2">
              Results for <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span>
              {' — '}
              <Link href="/explore" className="underline hover:text-white transition-colors">
                Clear
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Category Pills ────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-8 overflow-x-auto">
          <div className="flex items-center gap-2 pb-2 w-max min-w-full">
            {categories.slice(0, 12).map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="flex-shrink-0 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/categories"
              className="flex-shrink-0 rounded-full border border-dashed border-gray-300 bg-transparent px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all whitespace-nowrap"
            >
              All categories →
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-12">
        {/* ── Tab Bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {[
            { key: 'work', label: '🎨 Work Feed' },
            { key: 'creators', label: '👥 Creators' },
            { key: 'products', label: '🛍️ Products' },
            { key: 'services', label: '🛠️ Services' },
            { key: 'categories', label: '📂 Categories' },
          ].map(({ key, label }) => {
            const href = q
              ? `/explore?q=${encodeURIComponent(q)}&tab=${key}`
              : `/explore?tab=${key}`;
            const isActive = activeTab === key;
            return (
              <Link
                key={key}
                href={href}
                className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all -mb-px border border-transparent whitespace-nowrap ${
                  isActive
                    ? 'bg-white border-gray-200 border-b-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Work Feed Tab ─────────────────────────────────────── */}
        {activeTab === 'work' && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Creator Work</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Real work by verified creators — portfolio, products, and behind-the-scenes
                </p>
              </div>
            </div>

            <CreatorPostGrid
              posts={workFeed.data}
              showCreator={true}
              emptyMessage="No work posts yet. Check back as creators share their work!"
            />

            {workFeed.hasNext && (
              <div className="flex justify-center mt-8">
                <Link
                  href={`/explore?tab=work&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm"
                >
                  Load more work →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ── Creators Tab ─────────────────────────────────────── */}
        {activeTab === 'creators' && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Meet Our Creators</h2>
              <Link
                href="/creators"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View all →
              </Link>
            </div>

            {creators.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
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

        {/* ── Products Tab ─────────────────────────────────────── */}
        {activeTab === 'products' && products && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Unique Products</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Handcrafted physical goods and digital assets directly from creators
                </p>
              </div>
            </div>

            {products.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-400 text-lg font-medium">No products found</p>
                {q && <p className="text-gray-400 text-sm mt-1">Try a different search query.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {products.data.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            {products.meta.hasNext && (
              <div className="flex justify-center mt-8">
                <Link
                  href={`/explore?tab=products&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm"
                >
                  Load more products →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ── Services Tab ─────────────────────────────────────── */}
        {activeTab === 'services' && services && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Professional Services</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Commission custom work, mentorship, learning, and event bookings
                </p>
              </div>
            </div>

            {services.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Wrench className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-400 text-lg font-medium">No services found</p>
                {q && <p className="text-gray-400 text-sm mt-1">Try a different search query.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {services.data.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            {services.meta.hasNext && (
              <div className="flex justify-center mt-8">
                <Link
                  href={`/explore?tab=services&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm"
                >
                  Load more services →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ── Categories Tab ────────────────────────────────────── */}
        {activeTab === 'categories' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Explore by Category</h2>
              <p className="text-sm text-gray-500 mt-1">
                Browse our curated categories of physical products, design, learning, and custom work
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {cat.type === 'product' ? '🛍️' : cat.type === 'service' ? '🛠️' : '✨'}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 px-2 py-0.5 rounded group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                      {cat.type}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                    {cat.description ?? `Browse all listings under ${cat.name}.`}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick Links ────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4">
          {[
            {
              href: '/listings',
              title: 'All Listings',
              desc: 'Browse every approved product and service',
              emoji: '🏪',
            },
            {
              href: '/creators',
              title: 'All Creators',
              desc: 'Discover talented people on Rosovia',
              emoji: '🧑‍🎨',
            },
            {
              href: '/categories',
              title: 'All Categories',
              desc: "Find exactly what you're looking for",
              emoji: '📂',
            },
          ].map(({ href, title, desc, emoji }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">
                {emoji}
              </span>
              <p className="font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

