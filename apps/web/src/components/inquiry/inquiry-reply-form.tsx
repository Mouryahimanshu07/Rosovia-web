'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { replyToInquiryAction } from '~/app/dashboard/creator/inquiries/actions';

interface InquiryReplyFormProps {
  inquiryId: string;
  onSuccess?: () => void;
}

export function InquiryReplyForm({ inquiryId, onSuccess }: InquiryReplyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (response.trim().length < 2) {
      setError('Response must be at least 2 characters.');
      return;
    }
    if (response.length > 2000) {
      setError('Response must be 2000 characters or fewer.');
      return;
    }

    startTransition(async () => {
      const result = await replyToInquiryAction({
        inquiryId,
        creatorResponse: response.trim(),
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSubmitted(true);
        onSuccess?.();
        router.refresh();
      }
    });
  };

  if (submitted) {
    return (
      <p className="text-xs text-green-700 font-medium">
        ✓ Reply sent
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3">
      <div>
        <label htmlFor={`reply-${inquiryId}`} className="block text-xs font-medium text-gray-600 mb-1">
          Your reply
          <span className="text-gray-400 font-normal ml-1">({response.length}/2000)</span>
        </label>
        <textarea
          id={`reply-${inquiryId}`}
          rows={4}
          placeholder="Write your response to the buyer..."
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          disabled={isPending}
          required
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || response.trim().length < 2}
        className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Send Reply'}
      </button>
    </form>
  );
}
