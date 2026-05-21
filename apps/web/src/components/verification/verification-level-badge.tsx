import type { VerificationLevel } from '@rosovia/core';

const BADGE_CONFIG: Record<VerificationLevel, {
  label: string;
  color: string;
  icon: string;
} | null> = {
  none: null,
  basic_verified: {
    label: 'Basic Verified',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '✓',
  },
  creator_verified: {
    label: 'Creator Verified',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: '✦',
  },
  seller_verified: {
    label: 'Seller Verified',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: '✦',
  },
  trusted_seller: {
    label: 'Trusted Seller',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '★',
  },
};

interface VerificationLevelBadgeProps {
  level: VerificationLevel;
  showUnverified?: boolean;
  className?: string;
}

export function VerificationLevelBadge({
  level,
  showUnverified = false,
  className = '',
}: VerificationLevelBadgeProps) {
  const config = BADGE_CONFIG[level];

  if (!config) {
    if (!showUnverified) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-gray-50 text-gray-500 border-gray-200 ${className}`}
        aria-label="Unverified creator"
      >
        Unverified
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${config.color} ${className}`}
      aria-label={`Verification status: ${config.label}`}
      title={`Verification status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}
