import Link from 'next/link';
import { X } from 'lucide-react';

interface ActiveFilter {
  label: string;
  param: string;
}

interface ActiveFiltersProps {
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
  /** Which params represent filters (exclude from clear logic if desired) */
  filterKeys: string[];
}

function buildClearHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  removeKey: string
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === removeKey || key === 'page') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const FILTER_LABELS: Record<string, string> = {
  q: 'Search',
  category: 'Category',
  listingType: 'Type',
  minPrice: 'Min Price',
  maxPrice: 'Max Price',
  city: 'City',
  state: 'State',
  verifiedOnly: 'Verified',
  customOrderAvailable: 'Custom Order',
  onlineAvailable: 'Online',
  offlineAvailable: 'Offline',
  sort: 'Sort',
};

/**
 * Shows active filter pills with individual clear links.
 */
export function ActiveFilters({
  searchParams,
  basePath,
  filterKeys,
}: ActiveFiltersProps) {
  const active: ActiveFilter[] = [];

  for (const key of filterKeys) {
    const value = searchParams[key];
    if (!value || value === '' || value === 'newest') continue;
    const label = FILTER_LABELS[key] ?? key;
    const displayValue = Array.isArray(value) ? value.join(', ') : value;
    active.push({
      label: `${label}: ${displayValue}`,
      param: key,
    });
  }

  if (active.length === 0) return null;

  // Clear-all href
  const clearAllParams = new URLSearchParams();
  const qs = clearAllParams.toString();
  const clearAllHref = qs ? `${basePath}?${qs}` : basePath;

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <span className="text-xs text-gray-500 font-medium">Filters:</span>
      {active.map(({ label, param }) => (
        <Link
          key={param}
          href={buildClearHref(basePath, searchParams, param)}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          {label}
          <X className="h-3 w-3" aria-hidden="true" />
        </Link>
      ))}
      <Link
        href={clearAllHref}
        className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
      >
        Clear all
      </Link>
    </div>
  );
}
