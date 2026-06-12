'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

export function DashboardSearchInput() {
  const [query, setQuery] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = query.trim();
      window.location.href = `/explore?q=${encodeURIComponent(val)}`;
    }
  };

  return (
    <div className="relative w-80 hidden sm:block animate-fadeIn">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
        <Search className="h-4 w-4" />
      </span>
      <input
        type="text"
        placeholder="Search workspaces..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
      />
    </div>
  );
}
