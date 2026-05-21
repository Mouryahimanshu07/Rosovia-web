import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCategoriesPageData } from '@rosovia/api';
import { CategoryCard } from '~/components/category/category-card';
import { CategoryFilterTabs } from '~/components/category/category-filter-tabs';
import { SearchBar } from '~/components/search/search-bar';

export const metadata: Metadata = {
  title: 'Categories — Rosovia',
  description: 'Explore all talent and product categories on Rosovia — from handmade crafts and digital services to mentorship and performing arts.',
};

interface CategoriesPageProps {
  searchParams: Record<string, string | undefined>;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const supabase = createWebServerClient();
  const categories = await getCategoriesPageData(
    supabase,
    searchParams as Record<string, string | string[] | undefined>
  );

  const q = searchParams.q ?? '';
  const type = searchParams.type ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Categories</h1>
          <p className="text-gray-500 mb-6">
            Find verified talent across products, services, learning, and more.
          </p>
          <div className="mb-5">
            <Suspense>
              <SearchBar
                action="/categories"
                defaultValue={q}
                placeholder="Search categories…"
              />
            </Suspense>
          </div>
          <CategoryFilterTabs
            current={type}
            basePath="/categories"
            searchParams={searchParams as Record<string, string | string[] | undefined>}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <p className="text-gray-400 text-lg font-medium">No categories found</p>
            {(q || type) && (
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your search or filters.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
              {q && ` matching "${q}"`}
              {type && ` · ${type}`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
