'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  /** The path this form submits to (e.g. "/listings") */
  action?: string;
  /** Current query value — pre-fills input */
  defaultValue?: string;
  placeholder?: string;
}

/**
 * Global search bar.
 * Uses a native GET <form> so the browser navigates to ?q=... on submit.
 * JavaScript-enhanced for inline submission feel, but fully SSR-compatible.
 */
export function SearchBar({
  action = '/explore',
  defaultValue = '',
  placeholder = 'Search creators, listings, categories…',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? '';
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    // Reset to page 1 on new search
    params.delete('page');
    router.push(`${action}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full max-w-2xl items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition"
    >
      <Search className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        id="search-input"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
        aria-label="Search"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
