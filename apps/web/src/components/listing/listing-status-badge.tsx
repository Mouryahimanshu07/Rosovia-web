import type { ListingStatus } from '@rosovia/core';

const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string }> = {
  draft:          { label: 'Draft',          color: 'bg-gray-100 text-gray-600 border-gray-200' },
  pending_review: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:       { label: 'Approved',       color: 'bg-green-50 text-green-700 border-green-200' },
  rejected:       { label: 'Rejected',       color: 'bg-red-50 text-red-700 border-red-200' },
  archived:       { label: 'Archived',       color: 'bg-gray-100 text-gray-500 border-gray-200' },
  suspended:      { label: 'Suspended',      color: 'bg-red-100 text-red-800 border-red-300' },
};

interface ListingStatusBadgeProps {
  status: ListingStatus;
  className?: string;
}

export function ListingStatusBadge({ status, className = '' }: ListingStatusBadgeProps) {
  const { label, color } = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  );
}
