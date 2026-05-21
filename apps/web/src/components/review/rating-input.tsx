'use client';

interface RatingInputProps {
  name: string;
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

const STAR_LABELS: Record<number, string> = {
  1: '1 — Poor',
  2: '2 — Fair',
  3: '3 — Good',
  4: '4 — Very Good',
  5: '5 — Excellent',
};

export function RatingInput({
  name,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
}: RatingInputProps) {
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </legend>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {RATINGS.map((star) => {
          const inputId = `${name}-${star}`;
          const isSelected = value === star;
          return (
            <label
              key={star}
              htmlFor={inputId}
              className={[
                'flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border text-base transition-all',
                isSelected
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600',
                disabled ? 'cursor-not-allowed opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={STAR_LABELS[star]}
            >
              <input
                type="radio"
                id={inputId}
                name={name}
                value={star}
                checked={isSelected}
                onChange={() => onChange(star)}
                disabled={disabled}
                required={required && !value}
                className="sr-only"
                aria-label={STAR_LABELS[star]}
              />
              ★
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
