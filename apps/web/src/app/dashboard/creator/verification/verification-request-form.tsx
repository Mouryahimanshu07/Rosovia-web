'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@rosovia/core';
import {
  VERIFICATION_TYPES,
  REQUESTABLE_LEVELS,
  VERIFICATION_DOCUMENT_TYPES,
} from '@rosovia/core';
import { MediaUpload } from '~/components/media/media-upload';

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const VERIFICATION_TYPE_LABELS: Record<string, string> = {
  creator: 'Creator Identity',
  seller: 'Seller / Product Business',
  mentor: 'Mentor / Coach',
  business: 'Registered Business',
};

const LEVEL_LABELS: Record<string, string> = {
  basic_verified: 'Basic Verified — Identity confirmed',
  creator_verified: 'Creator Verified — Stronger creator proof',
  seller_verified: 'Seller Verified — Authorized to sell products/services',
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  identity: 'Government-issued Identity (Aadhaar, Passport, etc.)',
  business: 'Business Registration / GST Certificate',
  portfolio: 'Portfolio / Work Samples',
  address: 'Address Proof',
  certificate: 'Professional Certificate / Diploma',
  other: 'Other Document',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VerificationRequestFormProps {
  /** Disable types that already have a pending request */
  pendingTypes?: string[];
}

export function VerificationRequestForm({ pendingTypes = [] }: VerificationRequestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [verificationType, setVerificationType] = useState('creator');
  const [requestedLevel, setRequestedLevel] = useState('basic_verified');
  const [documentType, setDocumentType] = useState('identity');
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const availableTypes = VERIFICATION_TYPES.filter((t) => !pendingTypes.includes(t));
  const hasPendingForSelected = pendingTypes.includes(verificationType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!uploadedMedia) {
      setError('Please upload a verification document before submitting.');
      return;
    }

    if (hasPendingForSelected) {
      setError(`You already have a pending ${verificationType} verification request.`);
      return;
    }

    startTransition(async () => {
      const { createVerificationRequestAction } = await import('./actions');
      const result = await createVerificationRequestAction({
        verificationType: verificationType as 'creator' | 'seller' | 'mentor' | 'business',
        requestedLevel: requestedLevel as 'basic_verified' | 'creator_verified' | 'seller_verified',
        documentType: documentType as 'identity' | 'business' | 'portfolio' | 'address' | 'certificate' | 'other',
        documentMediaId: uploadedMedia.id,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSubmitted(true);
        router.refresh();
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-3xl mb-3" aria-hidden="true">✅</div>
        <p className="text-sm font-semibold text-green-800">Verification request submitted!</p>
        <p className="text-xs text-green-700 mt-1">
          Our team will review your request within 1–3 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Verification type */}
      <div>
        <label htmlFor="verification-type" className="block text-sm font-medium text-gray-700 mb-1">
          Verification Type <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="verification-type"
          value={verificationType}
          onChange={(e) => setVerificationType(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        >
          {availableTypes.map((t) => (
            <option key={t} value={t} disabled={pendingTypes.includes(t)}>
              {VERIFICATION_TYPE_LABELS[t] ?? t}
              {pendingTypes.includes(t) ? ' (pending)' : ''}
            </option>
          ))}
          {availableTypes.length === 0 && (
            <option value="" disabled>All verification types have pending requests</option>
          )}
        </select>
        {hasPendingForSelected && (
          <p className="text-xs text-amber-600 mt-1">
            You already have a pending request for this type.
          </p>
        )}
      </div>

      {/* Requested level */}
      <div>
        <label htmlFor="requested-level" className="block text-sm font-medium text-gray-700 mb-1">
          Verification Level <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="requested-level"
          value={requestedLevel}
          onChange={(e) => setRequestedLevel(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        >
          {REQUESTABLE_LEVELS.map((l) => (
            <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>
          ))}
        </select>
      </div>

      {/* Document type */}
      <div>
        <label htmlFor="document-type" className="block text-sm font-medium text-gray-700 mb-1">
          Document Type <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="document-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        >
          {VERIFICATION_DOCUMENT_TYPES.map((d) => (
            <option key={d} value={d}>{DOCUMENT_TYPE_LABELS[d] ?? d}</option>
          ))}
        </select>
      </div>

      {/* Document upload */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Verification Document <span className="text-red-500" aria-hidden="true">*</span>
        </p>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <MediaUpload
            usage="verification_document"
            isPrivate={true}
            label="Upload document"
            onUploaded={(media) => setUploadedMedia(media)}
          />
          {uploadedMedia && (
            <p className="text-xs text-green-700 mt-2">
              ✓ Document uploaded (private, secure). Ready to submit.
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Your document is uploaded privately and is never shared publicly. Only Rosovia team members can access it for verification purposes.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        id="submit-verification-request"
        disabled={isPending || !uploadedMedia || hasPendingForSelected || availableTypes.length === 0}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
            Submitting…
          </span>
        ) : (
          'Submit Verification Request'
        )}
      </button>
    </form>
  );
}
