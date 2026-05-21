import type { InquiryWithDetails } from '@rosovia/core';
import { InquiryStatusBadge } from './inquiry-status-badge';

interface InquiryCardProps {
  inquiry: InquiryWithDetails;
  /** Slot for action buttons rendered by parent (server or client component). */
  actions?: React.ReactNode;
  /** Show buyer info (creator view) or creator info (buyer view) */
  viewAs: 'buyer' | 'creator';
}

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  general: 'General',
  product: 'Product',
  service: 'Service',
  mentorship: 'Mentorship',
  custom_order: 'Custom Order',
};

export function InquiryCard({ inquiry, actions, viewAs }: InquiryCardProps) {
  const formattedDate = new Date(inquiry.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const counterpartyName =
    viewAs === 'buyer'
      ? (inquiry.creator_display_name ?? 'Unknown creator')
      : (inquiry.buyer_full_name ?? inquiry.buyer_username ?? 'Unknown buyer');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-900">{counterpartyName}</p>
          {inquiry.listing_title && (
            <p className="text-xs text-indigo-600">
              Re: {inquiry.listing_title}
            </p>
          )}
          <p className="text-xs text-gray-400">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            {INQUIRY_TYPE_LABEL[inquiry.inquiry_type] ?? inquiry.inquiry_type}
          </span>
          <InquiryStatusBadge status={inquiry.status} />
        </div>
      </div>

      {/* Message */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-medium text-gray-500 mb-1">Message</p>
        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {inquiry.message}
        </p>
      </div>

      {/* Creator response */}
      {inquiry.creator_response && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
          <p className="text-xs font-medium text-indigo-500 mb-1">
            {viewAs === 'buyer' ? "Creator's reply" : 'Your reply'}
          </p>
          <p className="text-sm text-indigo-900 whitespace-pre-line leading-relaxed">
            {inquiry.creator_response}
          </p>
          {inquiry.replied_at && (
            <p className="text-xs text-indigo-400 mt-1">
              {new Date(inquiry.replied_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      )}

      {/* Actions slot */}
      {actions && <div className="pt-1">{actions}</div>}
    </div>
  );
}
