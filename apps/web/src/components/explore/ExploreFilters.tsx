'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { DbCategory } from '@rosovia/core';
import { Filter, SlidersHorizontal, Check } from 'lucide-react';

interface ExploreFiltersProps {
  categories: DbCategory[];
}

export function ExploreFilters({ categories }: ExploreFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') ?? 'all';
  const currentType = searchParams.get('type') ?? 'all';
  const currentVerified = searchParams.get('verified') ?? 'all';
  const currentSort = searchParams.get('sort') ?? 'newest';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <div className="w-full bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left side: filter labels */}
      <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm">
        <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
        <span>Filters</span>
      </div>

      {/* Right side: filter dropdowns / controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 max-w-4xl">
        {/* Category Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
          <select
            value={currentCategory}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Content Type Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Content Type</label>
          <select
            value={currentType}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="all">All Content</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>

        {/* Creator Type Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creator Type</label>
          <select
            value={currentVerified}
            onChange={(e) => updateFilter('verified', e.target.value)}
            className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="all">All Creators</option>
            <option value="true">Verified Only</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort By</label>
          <select
            value={currentSort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition"
          >
            <option value="newest">Latest</option>
            <option value="popular">Popular</option>
          </select>
        </div>
      </div>
    </div>
  );
}
