'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { creatorQuoteCustomOrderSchema } from '@rosovia/core';
import { quoteCustomOrderAction } from '~/app/dashboard/creator/custom-orders/actions';

interface CustomOrderQuoteFormProps {
  customOrderId: string;
  onSuccess?: () => void;
}

export function CustomOrderQuoteForm({ customOrderId, onSuccess }: CustomOrderQuoteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = creatorQuoteCustomOrderSchema.safeParse({
      customOrderId,
      creatorQuoteAmount: quoteAmount ? parseFloat(quoteAmount) : undefined,
      creatorQuoteNote: quoteNote.trim() || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your inputs.');
      return;
    }

    startTransition(async () => {
      const result = await quoteCustomOrderAction(parsed.data);
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
      <p className="text-xs text-green-700 font-medium">✓ Quote submitted successfully</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-700">Submit a quote</p>

      <div>
        <label htmlFor={`quote-amount-${customOrderId}`} className="block text-xs font-medium text-gray-600 mb-1">
          Quote amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          id={`quote-amount-${customOrderId}`}
          type="number"
          min={0}
          placeholder="e.g. 3500"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
          disabled={isPending}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor={`quote-note-${customOrderId}`} className="block text-xs font-medium text-gray-600 mb-1">
          Quote note
          <span className="text-gray-400 font-normal ml-1">({quoteNote.length}/2000)</span>
        </label>
        <textarea
          id={`quote-note-${customOrderId}`}
          rows={3}
          placeholder="Explain what is included in your quote, timeline, materials, etc."
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          disabled={isPending}
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
        disabled={isPending || !quoteAmount}
        className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Submitting…' : 'Submit Quote'}
      </button>
    </form>
  );
}
