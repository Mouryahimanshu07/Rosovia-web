import Link from 'next/link';

interface CategoryFilterTabsProps {
  current?: string;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}

const TYPES = [
  { value: '', label: 'All' },
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
  { value: 'learning', label: 'Learning' },
  { value: 'performance', label: 'Performance' },
  { value: 'mixed', label: 'Mixed' },
] as const;

function buildTypeHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  type: string
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'type' || key === 'page') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  if (type) params.set('type', type);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Horizontal tab row for filtering categories by type.
 * Pure server component — all navigation via links.
 */
export function CategoryFilterTabs({
  current = '',
  basePath,
  searchParams,
}: CategoryFilterTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Filter categories by type"
    >
      {TYPES.map(({ value, label }) => {
        const isActive = current === value;
        return (
          <Link
            key={value || 'all'}
            href={buildTypeHref(basePath, searchParams, value)}
            role="tab"
            aria-selected={isActive}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              isActive
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
