import type { CustomOrderStatus } from '@rosovia/core';

interface CustomOrderStatusBadgeProps {
  status: CustomOrderStatus;
}

const STATUS_CONFIG: Partial<Record<CustomOrderStatus, { label: string; className: string }>> = {
  requested: {
    label: 'Requested',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  creator_reviewing: {
    label: 'Reviewing',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  quoted: {
    label: 'Quoted',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

const FALLBACK_CONFIG = {
  label: 'Unknown',
  className: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function CustomOrderStatusBadge({ status }: CustomOrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? FALLBACK_CONFIG;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
