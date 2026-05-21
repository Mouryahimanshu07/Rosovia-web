import type { DbCategory } from '@rosovia/core';

interface FilterPanelProps {
  /** "listings" | "creators" */
  mode: 'listings' | 'creators';
  basePath: string;
  currentParams: Record<string, string | string[] | undefined>;
  categories: DbCategory[];
}

function val(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = params[key];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

/**
 * A plain GET <form> for filter controls.
 * Accessible, no JS required — submitting navigates to basePath?filters...
 */
export function FilterPanel({
  mode,
  basePath,
  currentParams,
  categories,
}: FilterPanelProps) {
  return (
    <form
      method="GET"
      action={basePath}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 shadow-sm"
    >
      {/* Search query */}
      <div>
        <label htmlFor="fp-q" className="block text-xs font-semibold text-gray-600 mb-1">
          Search
        </label>
        <input
          id="fp-q"
          type="search"
          name="q"
          defaultValue={val(currentParams, 'q')}
          placeholder="Keywords…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="fp-category" className="block text-xs font-semibold text-gray-600 mb-1">
          Category
        </label>
        <select
          id="fp-category"
          name="category"
          defaultValue={val(currentParams, 'category')}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {mode === 'listings' && (
        <>
          {/* Listing type */}
          <div>
            <label htmlFor="fp-listingType" className="block text-xs font-semibold text-gray-600 mb-1">
              Type
            </label>
            <select
              id="fp-listingType"
              name="listingType"
              defaultValue={val(currentParams, 'listingType')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">All types</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="mentorship">Mentorship</option>
              <option value="workshop">Workshop</option>
              <option value="event_booking">Event Booking</option>
              <option value="portfolio">Portfolio</option>
            </select>
          </div>

          {/* Price range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fp-minPrice" className="block text-xs font-semibold text-gray-600 mb-1">
                Min Price
              </label>
              <input
                id="fp-minPrice"
                type="number"
                name="minPrice"
                min="0"
                defaultValue={val(currentParams, 'minPrice')}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label htmlFor="fp-maxPrice" className="block text-xs font-semibold text-gray-600 mb-1">
                Max Price
              </label>
              <input
                id="fp-maxPrice"
                type="number"
                name="maxPrice"
                min="0"
                defaultValue={val(currentParams, 'maxPrice')}
                placeholder="Any"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Boolean filters */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-600">Options</legend>
            {[
              { id: 'fp-online', name: 'onlineAvailable', label: 'Online available' },
              { id: 'fp-offline', name: 'offlineAvailable', label: 'Offline / in-person' },
              { id: 'fp-custom', name: 'customOrderAvailable', label: 'Custom orders accepted' },
            ].map(({ id, name, label }) => (
              <label key={id} htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  id={id}
                  type="checkbox"
                  name={name}
                  value="true"
                  defaultChecked={val(currentParams, name) === 'true'}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </>
      )}

      {/* City / State (both modes) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="fp-city" className="block text-xs font-semibold text-gray-600 mb-1">
            City
          </label>
          <input
            id="fp-city"
            type="text"
            name="city"
            defaultValue={val(currentParams, 'city')}
            placeholder="City"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label htmlFor="fp-state" className="block text-xs font-semibold text-gray-600 mb-1">
            State
          </label>
          <input
            id="fp-state"
            type="text"
            name="state"
            defaultValue={val(currentParams, 'state')}
            placeholder="State"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Verified only (both modes) */}
      <label htmlFor="fp-verified" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          id="fp-verified"
          type="checkbox"
          name="verifiedOnly"
          value="true"
          defaultChecked={val(currentParams, 'verifiedOnly') === 'true'}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
        />
        Verified creators only
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
      >
        Apply Filters
      </button>
    </form>
  );
}
