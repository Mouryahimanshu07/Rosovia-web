interface RatingDisplayProps {
  avg: number;
  count: number;
  className?: string;
}

function renderStars(avg: number): string {
  const full = Math.round(avg);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function RatingDisplay({ avg, count, className = '' }: RatingDisplayProps) {
  if (count === 0) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="text-sm text-gray-400" aria-label="No reviews yet">
          ☆☆☆☆☆
        </span>
        <span className="text-xs text-gray-400">No reviews yet</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={`${avg.toFixed(1)} out of 5, ${count} review${count !== 1 ? 's' : ''}`}>
      <span className="text-amber-400 text-sm tracking-tight" aria-hidden="true">
        {renderStars(avg)}
      </span>
      <span className="text-sm font-semibold text-gray-900">{avg.toFixed(1)}</span>
      <span className="text-xs text-gray-500">
        ({count} review{count !== 1 ? 's' : ''})
      </span>
    </div>
  );
}
