import Link from 'next/link';

interface PaginationProps {
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  total: number | null;
  /** The current URL's search params as a plain object so links can preserve filters */
  searchParams: Record<string, string | string[] | undefined>;
  /** Base path for page links */
  basePath?: string;
}

function buildPageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  targetPage: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  if (targetPage > 1) params.set('page', String(targetPage));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Pagination controls that preserve all existing query params in the links.
 */
export function Pagination({
  page,
  hasNext,
  hasPrev,
  total,
  searchParams,
  basePath = '',
}: PaginationProps) {
  const prevHref = buildPageHref(basePath, searchParams, page - 1);
  const nextHref = buildPageHref(basePath, searchParams, page + 1);

  return (
    <nav
      className="flex items-center justify-between py-6"
      aria-label="Pagination"
    >
      <div className="text-sm text-gray-500">
        {total !== null && (
          <span>{total.toLocaleString()} result{total !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {hasPrev ? (
          <Link
            href={prevHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            ← Previous
          </span>
        )}
        <span className="text-sm text-gray-600 font-medium">Page {page}</span>
        {hasNext ? (
          <Link
            href={nextHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
