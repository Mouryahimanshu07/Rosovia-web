import type { InquiryStatus } from '@rosovia/core';

interface InquiryStatusBadgeProps {
  status: InquiryStatus;
}

const STATUS_CONFIG: Record<
  InquiryStatus,
  { label: string; className: string }
> = {
  open: {
    label: 'Open',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  replied: {
    label: 'Replied',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  closed: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  spam: {
    label: 'Spam',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
};

export function InquiryStatusBadge({ status }: InquiryStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
