'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { customOrderCreateSchema } from '@rosovia/core';
import type { CustomOrderCreateInput } from '@rosovia/core';

interface CustomOrderFormProps {
  creatorId: string;
  listingId?: string;
  categoryId: string;
  /** Pre-filled title, e.g. from listing context. */
  defaultTitle?: string;
  onSuccess?: () => void;
}

export function CustomOrderForm({
  creatorId,
  listingId,
  categoryId,
  defaultTitle = '',
  onSuccess,
}: CustomOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');

  // Minimum date for deadline picker — today
  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawInput: CustomOrderCreateInput = {
      creatorId,
      listingId: listingId || undefined,
      categoryId,
      title: title.trim(),
      description: description.trim(),
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      deadline: deadline || undefined,
      deliveryCity: deliveryCity.trim() || undefined,
      deliveryState: deliveryState.trim() || undefined,
    };

    const parsed = customOrderCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your inputs.');
      return;
    }

    startTransition(async () => {
      const { createCustomOrderAction } = await import(
        '~/app/dashboard/(portal)/buyer/custom-orders/actions'
      );
      const result = await createCustomOrderAction(parsed.data);

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
        <p className="text-sm font-semibold text-green-800">
          ✓ Custom order request sent
        </p>
        <p className="text-xs text-green-700 mt-1">
          The creator will review your request and provide a quote.
        </p>
        <div className="mt-4 flex gap-3 justify-center">
          <a
            href="/dashboard/buyer/custom-orders"
            className="text-xs text-green-700 underline hover:no-underline"
          >
            View my custom orders →
          </a>
        </div>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-2 text-xs text-green-600 underline hover:no-underline"
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Title */}
      <div>
        <label htmlFor="co-title" className="block text-sm font-medium text-gray-700 mb-1">
          Request title <span className="text-red-500">*</span>
        </label>
        <input
          id="co-title"
          type="text"
          placeholder="e.g. Custom portrait painting of my family"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          required
          maxLength={160}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <p className="text-xs text-gray-400 mt-0.5 text-right">{title.length}/160</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="co-description" className="block text-sm font-medium text-gray-700 mb-1">
          Describe your requirements <span className="text-red-500">*</span>
        </label>
        <textarea
          id="co-description"
          rows={5}
          placeholder="Describe exactly what you need: size, style, materials, colors, deadline reasons, or any specific details the creator should know..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          required
          maxLength={4000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
        />
        <p className="text-xs text-gray-400 mt-0.5 text-right">{description.length}/4000</p>
      </div>

      {/* Budget range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="co-budget-min" className="block text-sm font-medium text-gray-700 mb-1">
            Budget min (₹)
          </label>
          <input
            id="co-budget-min"
            type="number"
            min={0}
            placeholder="0"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="co-budget-max" className="block text-sm font-medium text-gray-700 mb-1">
            Budget max (₹)
          </label>
          <input
            id="co-budget-max"
            type="number"
            min={0}
            placeholder="e.g. 5000"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label htmlFor="co-deadline" className="block text-sm font-medium text-gray-700 mb-1">
          Deadline
        </label>
        <input
          id="co-deadline"
          type="date"
          min={todayStr}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
      </div>

      {/* Delivery location */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="co-city" className="block text-sm font-medium text-gray-700 mb-1">
            Delivery city
          </label>
          <input
            id="co-city"
            type="text"
            placeholder="e.g. Mumbai"
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
            disabled={isPending}
            maxLength={80}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="co-state" className="block text-sm font-medium text-gray-700 mb-1">
            Delivery state
          </label>
          <input
            id="co-state"
            type="text"
            placeholder="e.g. Maharashtra"
            value={deliveryState}
            onChange={(e) => setDeliveryState(e.target.value)}
            disabled={isPending}
            maxLength={80}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
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
        disabled={isPending || title.trim().length < 3 || description.trim().length < 20}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending request…' : 'Send Custom Order Request'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        The creator will review your request and provide a quote before any payment.
      </p>
    </form>
  );
}
