import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getExplorePageData, searchApprovedListings, getProfileByAuthUserId } from '@rosovia/api';
import { ListingCard } from '~/components/listing/listing-card';
import { CreatorProfileCard } from '~/components/creator/creator-profile-card';
import { ProfileCard } from '~/components/profile/ProfileCard';
import { SearchBar } from '~/components/search/search-bar';
import { InstagramWorkFeed } from '~/components/post/InstagramWorkFeed';
import { ExploreFilters } from '~/components/explore/ExploreFilters';
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
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileByAuthUserId(supabase, user.id) : null;

  const { categories, creators, people, workFeed, q } = await getExplorePageData(
    supabase,
    searchParams as Record<string, string | string[] | undefined>
  );

  const activeTab = searchParams.tab ?? 'work';
  const page = searchParams.page ? parseInt(searchParams.page) : 1;

  const category = searchParams.category;

  // Dynamically fetch products/services listings depending on the active tab
  let products = null;
  let services = null;

  if (activeTab === 'products') {
    products = await searchApprovedListings(supabase, {
      q,
      category,
      listingType: 'product',
      page,
    });
  } else if (activeTab === 'services') {
    services = await searchApprovedListings(supabase, {
      q,
      category,
      listingType: 'service',
      page,
    });
  }

  const hasNoResultsAnywhere =
    q &&
    categories.length === 0 &&
    creators.length === 0 &&
    people.length === 0 &&
    workFeed.data.length === 0 &&
    (!products || products.data.length === 0) &&
    (!services || services.data.length === 0);

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

      {hasNoResultsAnywhere ? (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-2xl">
              🔍
            </div>
            <h3 className="text-base font-bold text-gray-900">No results found</h3>
            <p className="text-sm text-gray-500">
              No results found for &ldquo;{q}&rdquo;. Try a different keyword.
            </p>
            <div className="pt-2">
              <Link
                href="/explore"
                className="inline-flex items-center rounded-full bg-gray-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-gray-800 transition shadow-sm"
              >
                Clear Search
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-12">
          {/* ── Tab Bar ──────────────────────────────────────────── */}
          <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
            {[
              { key: 'work', label: '🎨 Work Feed' },
              { key: 'creators', label: '👥 Creators' },
              { key: 'people', label: '👥 People' },
              { key: 'products', label: '🛍️ Products' },
              { key: 'services', label: '🛠️ Services' },
              { key: 'categories', label: '📂 Categories' },
            ].map(({ key, label }) => {
              let href = `/explore?tab=${key}`;
              if (q) href += `&q=${encodeURIComponent(q)}`;
              if (category) href += `&category=${encodeURIComponent(category)}`;
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

          {/* Advanced Search & Filtering Controls */}
          <Suspense>
            <ExploreFilters categories={categories} />
          </Suspense>

          {/* ── Work Feed Tab ─────────────────────────────────────── */}
          {activeTab === 'work' && (
            <section className="w-full">
              <div className="flex flex-col items-center mb-8 text-center">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Creator Work</h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-md">
                  Browse professional work, behind-the-scenes portfolios, and unique listings directly from India&apos;s verified creator talent.
                </p>
              </div>

              <InstagramWorkFeed
                initialPosts={workFeed.data}
                query={q}
                activeTab={activeTab}
                currentUserProfile={profile}
              />
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
                  <p className="text-gray-400 text-lg font-medium">
                    {q ? 'No results found for this search.' : 'No creators found.'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {q ? 'Try a different keyword.' : 'Check back soon as our community grows.'}
                  </p>
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

          {/* ── People Tab ────────────────────────────────────────── */}
          {activeTab === 'people' && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Discover People</h2>
              </div>

              {people.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                  <p className="text-gray-400 text-lg font-medium">
                    {q ? 'No results found for this search.' : 'No profiles found.'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {q ? 'Try a different keyword.' : 'Check back soon as our community grows.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {people.map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} />
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
                  <p className="text-gray-400 text-lg font-medium">
                    {q ? 'No results found for this search.' : 'No products found'}
                  </p>
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
                    href={`/explore?tab=products&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}`}
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
                  <p className="text-gray-400 text-lg font-medium">
                    {q ? 'No results found for this search.' : 'No services found'}
                  </p>
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
                    href={`/explore?tab=services&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}`}
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

              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-lg font-medium">
                    {q ? 'No results found for this search.' : 'No categories found'}
                  </p>
                  {q && <p className="text-gray-400 text-sm mt-1">Try a different search query.</p>}
                </div>
              ) : (
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
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

