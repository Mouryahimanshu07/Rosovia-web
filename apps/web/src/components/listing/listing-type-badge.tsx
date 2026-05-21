import type { ListingType } from '@rosovia/core';

const TYPE_CONFIG: Record<ListingType, { label: string; color: string }> = {
  product:       { label: 'Product',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  service:       { label: 'Service',       color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mentorship:    { label: 'Mentorship',    color: 'bg-purple-50 text-purple-700 border-purple-200' },
  workshop:      { label: 'Workshop',      color: 'bg-teal-50 text-teal-700 border-teal-200' },
  event_booking: { label: 'Event Booking', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  portfolio:     { label: 'Portfolio',     color: 'bg-pink-50 text-pink-700 border-pink-200' },
};

interface ListingTypeBadgeProps {
  type: ListingType;
  className?: string;
}

export function ListingTypeBadge({ type, className = '' }: ListingTypeBadgeProps) {
  const { label, color } = TYPE_CONFIG[type] ?? TYPE_CONFIG.service;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  );
}
