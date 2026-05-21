import type { VerificationLevel } from '@rosovia/core';
import { VerificationLevelBadge } from './verification-level-badge';

interface VerificationStatusCardProps {
  verificationLevel: VerificationLevel;
  isVerified: boolean;
  hasPendingRequest: boolean;
  latestRequestStatus?: 'pending' | 'approved' | 'rejected' | null;
  latestRequestType?: string | null;
  latestAdminNote?: string | null;
}

const STATUS_CONFIG = {
  pending: {
    border: 'border-amber-200 bg-amber-50',
    icon: '⏳',
    title: 'Verification Under Review',
    description: 'Your verification request is being reviewed by our team. This typically takes 1–3 business days.',
    textColor: 'text-amber-800',
    subColor: 'text-amber-700',
  },
  approved: {
    border: 'border-green-200 bg-green-50',
    icon: '✅',
    title: 'Verification Approved',
    description: 'Your verification request was approved. Your profile badge has been updated.',
    textColor: 'text-green-800',
    subColor: 'text-green-700',
  },
  rejected: {
    border: 'border-red-200 bg-red-50',
    icon: '❌',
    title: 'Verification Rejected',
    description: 'Your verification request was not approved.',
    textColor: 'text-red-800',
    subColor: 'text-red-700',
  },
};

export function VerificationStatusCard({
  verificationLevel,
  isVerified,
  hasPendingRequest,
  latestRequestStatus,
  latestRequestType,
  latestAdminNote,
}: VerificationStatusCardProps) {
  const statusConfig = latestRequestStatus ? STATUS_CONFIG[latestRequestStatus] : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      {/* Current verification level */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Current Verification Status</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <VerificationLevelBadge level={verificationLevel} showUnverified={true} />
            {isVerified && (
              <span className="text-xs text-green-600 font-medium">Profile verified ✓</span>
            )}
          </div>
        </div>
      </div>

      {/* Latest request status */}
      {statusConfig && latestRequestStatus && (
        <div className={`rounded-lg border p-4 ${statusConfig.border}`}>
          <div className="flex items-start gap-3">
            <span className="text-base flex-shrink-0" aria-hidden="true">{statusConfig.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${statusConfig.textColor}`}>
                {statusConfig.title}
                {latestRequestType && (
                  <span className="font-normal ml-1">
                    ({latestRequestType} verification)
                  </span>
                )}
              </p>
              <p className={`text-xs mt-0.5 ${statusConfig.subColor}`}>
                {statusConfig.description}
              </p>
              {latestRequestStatus === 'rejected' && latestAdminNote && (
                <p className="text-xs mt-2 text-red-700 bg-red-100/60 rounded-md px-2 py-1.5 border border-red-200">
                  <strong>Reason:</strong> {latestAdminNote}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No request yet + unverified */}
      {!latestRequestStatus && verificationLevel === 'none' && (
        <p className="text-xs text-gray-500">
          You haven&apos;t submitted a verification request yet. Use the form below to get verified.
        </p>
      )}

      {/* Has pending — suppress form */}
      {hasPendingRequest && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          You have a pending verification request. You can submit a new request for a different verification type once this one is reviewed.
        </p>
      )}
    </div>
  );
}
