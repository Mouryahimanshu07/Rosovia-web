import type { VerificationRequestWithDetails } from '@rosovia/core';

interface VerificationRequestCardProps {
  request: VerificationRequestWithDetails;
  /** Show admin note and document metadata — only for admin view */
  showAdminDetails?: boolean;
}

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending: { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending Review' },
  approved: { badge: 'bg-green-50 text-green-700 border-green-200', label: 'Approved' },
  rejected: { badge: 'bg-red-50 text-red-700 border-red-200', label: 'Rejected' },
};

const LEVEL_LABELS: Record<string, string> = {
  basic_verified: 'Basic Verified',
  creator_verified: 'Creator Verified',
  seller_verified: 'Seller Verified',
};

const TYPE_LABELS: Record<string, string> = {
  creator: 'Creator',
  seller: 'Seller',
  mentor: 'Mentor',
  business: 'Business',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  identity: 'Identity Document',
  business: 'Business Document',
  portfolio: 'Portfolio',
  address: 'Address Proof',
  certificate: 'Certificate',
  other: 'Other',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FALLBACK_STATUS_STYLE = { badge: 'bg-gray-50 text-gray-600 border-gray-200', label: 'Unknown' };

export function VerificationRequestCard({
  request,
  showAdminDetails = false,
}: VerificationRequestCardProps) {
  const statusStyle = STATUS_STYLES[request.status] ?? FALLBACK_STATUS_STYLE;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">
              {TYPE_LABELS[request.verification_type] ?? request.verification_type} Verification
            </p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusStyle.badge}`}
            >
              {statusStyle.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Requested level: <strong>{LEVEL_LABELS[request.requested_level] ?? request.requested_level}</strong>
          </p>
        </div>
        <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(request.created_at)}</p>
      </div>

      {/* Document type */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700">Document type:</span>
        {DOC_TYPE_LABELS[request.document_type] ?? request.document_type}
      </div>

      {/* Document metadata — safe, no public URL */}
      {showAdminDetails && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1.5 text-xs">
          <p className="font-medium text-gray-700 mb-1">Document info (private — no download link)</p>
          {request.document_storage_key && (
            <p className="text-gray-600">
              <span className="text-gray-500">File:</span>{' '}
              {request.document_storage_key.split('/').pop() ?? request.document_storage_key}
            </p>
          )}
          {request.document_mime_type && (
            <p className="text-gray-600">
              <span className="text-gray-500">Type:</span> {request.document_mime_type}
            </p>
          )}
          {request.document_size_bytes !== null && (
            <p className="text-gray-600">
              <span className="text-gray-500">Size:</span> {formatBytes(request.document_size_bytes)}
            </p>
          )}
          {request.document_uploaded_at && (
            <p className="text-gray-600">
              <span className="text-gray-500">Uploaded:</span> {formatDate(request.document_uploaded_at)}
            </p>
          )}
          {request.creator_display_name && (
            <p className="text-gray-600">
              <span className="text-gray-500">Creator:</span> {request.creator_display_name}
            </p>
          )}
        </div>
      )}

      {/* Admin note — shown on rejection to creator, and always to admin */}
      {request.admin_note && (showAdminDetails || request.status === 'rejected') && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <p className="text-xs font-medium text-red-800 mb-0.5">
            {showAdminDetails ? 'Admin Note' : 'Reason for rejection'}
          </p>
          <p className="text-xs text-red-700">{request.admin_note}</p>
        </div>
      )}

      {/* Reviewer info */}
      {showAdminDetails && request.reviewed_by && (
        <p className="text-xs text-gray-400">
          Reviewed by {request.reviewed_by_name ?? 'Admin'}
          {request.reviewed_at && ` on ${formatDate(request.reviewed_at)}`}
        </p>
      )}
    </div>
  );
}
