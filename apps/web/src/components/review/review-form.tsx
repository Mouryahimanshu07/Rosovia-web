'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RatingInput } from './rating-input';

interface ReviewFormProps {
  orderId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ orderId, onSuccess }: ReviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState<number | undefined>(undefined);
  const [qualityRating, setQualityRating] = useState<number | undefined>(undefined);
  const [communicationRating, setCommunicationRating] = useState<number | undefined>(undefined);
  const [deliveryRating, setDeliveryRating] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rating) {
      setError('Please select an overall rating before submitting.');
      return;
    }

    if (comment.length > 2000) {
      setError('Comment must be 2000 characters or fewer.');
      return;
    }

    startTransition(async () => {
      const { createReviewAction } = await import('~/app/actions/reviews');
      const result = await createReviewAction({
        orderId,
        rating,
        qualityRating,
        communicationRating,
        deliveryRating,
        comment: comment.trim() || undefined,
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
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-2xl mb-2" aria-hidden="true">✓</p>
        <p className="text-sm font-semibold text-green-800">Review submitted successfully!</p>
        <p className="text-xs text-green-700 mt-1">
          Thank you for sharing your experience. Your review helps other buyers.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Overall rating — required */}
      <RatingInput
        name={`rating-${orderId}`}
        label="Overall Rating"
        value={rating}
        onChange={setRating}
        disabled={isPending}
        required
      />

      {/* Optional sub-ratings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RatingInput
          name={`quality-${orderId}`}
          label="Quality"
          value={qualityRating}
          onChange={setQualityRating}
          disabled={isPending}
        />
        <RatingInput
          name={`communication-${orderId}`}
          label="Communication"
          value={communicationRating}
          onChange={setCommunicationRating}
          disabled={isPending}
        />
        <RatingInput
          name={`delivery-${orderId}`}
          label="Delivery"
          value={deliveryRating}
          onChange={setDeliveryRating}
          disabled={isPending}
        />
      </div>

      {/* Comment — optional */}
      <div>
        <label
          htmlFor={`review-comment-${orderId}`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Comment{' '}
          <span className="text-gray-400 font-normal">
            (optional · {comment.length}/2000)
          </span>
        </label>
        <textarea
          id={`review-comment-${orderId}`}
          rows={4}
          placeholder="Describe your experience with this creator…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isPending}
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        id={`submit-review-${orderId}`}
        disabled={isPending || !rating}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
            Submitting…
          </span>
        ) : (
          'Submit Review'
        )}
      </button>
    </form>
  );
}
