interface AdminStatusBadgeProps {
  status: string;
  type?: 'user' | 'listing' | 'report' | 'review' | 'payment' | 'generic';
}

const STATUS_COLORS: Record<string, string> = {
  // User
  active: 'bg-green-50 text-green-700 ring-green-600/20',
  suspended: 'bg-red-50 text-red-700 ring-red-600/20',
  deleted: 'bg-gray-100 text-gray-500 ring-gray-400/20',
  // Listing
  draft: 'bg-gray-50 text-gray-600 ring-gray-400/20',
  pending_review: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  approved: 'bg-green-50 text-green-700 ring-green-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  archived: 'bg-gray-100 text-gray-500 ring-gray-400/20',
  // Report
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  reviewed: 'bg-blue-50 text-blue-700 ring-blue-700/10',
  resolved: 'bg-green-50 text-green-700 ring-green-600/20',
  // Payment
  paid: 'bg-green-50 text-green-700 ring-green-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
  created: 'bg-gray-50 text-gray-600 ring-gray-400/20',
  refunded: 'bg-purple-50 text-purple-700 ring-purple-700/10',
  // Review
  hidden: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  visible: 'bg-green-50 text-green-700 ring-green-600/20',
};

export function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-600 ring-gray-400/20';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${colorClass}`}>
      {label}
    </span>
  );
}
