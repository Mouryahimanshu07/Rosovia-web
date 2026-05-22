'use client';

interface SortSelectProps {
  options: { value: string; label: string }[];
  current: string;
  /** Name of the sort query param */
  paramName?: string;
}

/**
 * A plain <select> that submits its parent GET form on change.
 * Must be inside a <form> element.
 */
export function SortSelect({
  options,
  current,
  paramName = 'sort',
}: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-select" className="text-sm text-gray-500 whitespace-nowrap">
        Sort by:
      </label>
      <select
        id="sort-select"
        name={paramName}
        defaultValue={current}
        onChange={(e) => {
          const form = e.currentTarget.closest('form');
          if (form) form.requestSubmit();
        }}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
