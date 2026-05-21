import type { VerificationLevel } from '@rosovia/core';

const BADGE_CONFIG: Record<VerificationLevel, { label: string; color: string }> = {
  none: { label: '', color: '' },
  basic_verified: { label: 'Basic Verified', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  creator_verified: { label: 'Creator Verified', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  seller_verified: { label: 'Seller Verified', color: 'bg-green-50 text-green-700 border-green-200' },
  trusted_seller: { label: 'Trusted Seller', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

interface VerificationBadgeProps {
  level: VerificationLevel;
  className?: string;
}

export function VerificationBadge({ level, className = '' }: VerificationBadgeProps) {
  if (level === 'none') return null;
  const { label, color } = BADGE_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color} ${className}`}
      title={`Verification status: ${label}`}
      aria-label={`Verification status: ${label}`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
