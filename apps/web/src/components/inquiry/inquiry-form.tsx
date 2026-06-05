'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { INQUIRY_TYPES } from '@rosovia/core';
import type { InquiryType } from '@rosovia/core';

interface InquiryFormProps {
  creatorId: string;
  listingId?: string;
  defaultInquiryType?: InquiryType;
  onSuccess?: () => void;
}

const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  general: 'General',
  product: 'Product',
  service: 'Service',
  mentorship: 'Mentorship',
  custom_order: 'Custom Order',
};

export function InquiryForm({
  creatorId,
  listingId,
  defaultInquiryType = 'general',
  onSuccess,
}: InquiryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inquiryType, setInquiryType] = useState<InquiryType>(defaultInquiryType);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters.');
      return;
    }
    if (message.length > 2000) {
      setError('Message must be 2000 characters or fewer.');
      return;
    }

    startTransition(async () => {
      // Dynamic import to avoid including server action in client bundle unnecessarily
      const { createInquiryAction } = await import(
        '~/app/dashboard/(portal)/buyer/inquiries/actions'
      );
      const result = await createInquiryAction({
        creatorId,
        listingId,
        inquiryType,
        message: message.trim(),
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSubmitted(true);
        setMessage('');
        onSuccess?.();
        router.refresh();
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm font-semibold text-green-800">
          ✓ Inquiry sent successfully
        </p>
        <p className="text-xs text-green-700 mt-1">
          The creator will respond shortly.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-3 text-xs text-green-700 underline hover:no-underline"
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Inquiry type */}
      <div>
        <label
          htmlFor="inquiry-type"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Inquiry type
        </label>
        <select
          id="inquiry-type"
          value={inquiryType}
          onChange={(e) => setInquiryType(e.target.value as InquiryType)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {INQUIRY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="inquiry-message"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Message
          <span className="text-gray-400 font-normal ml-1">
            ({message.length}/2000)
          </span>
        </label>
        <textarea
          id="inquiry-message"
          rows={5}
          placeholder="Describe what you are looking for, your requirements, timeline, or any questions you have..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending}
          required
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || message.trim().length < 10}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Send Inquiry'}
      </button>
    </form>
  );
}
