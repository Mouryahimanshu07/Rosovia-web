'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { generateCustomOfferAction } from './actions';

interface CustomOfferFormProps {
  inquiryId: string;
}

export function CustomOfferForm({ inquiryId }: CustomOfferFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [price, setPrice] = React.useState('');
  const [deliveryDays, setDeliveryDays] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceNum = parseFloat(price);
    const daysNum = parseInt(deliveryDays);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid price greater than 0.');
      return;
    }

    if (isNaN(daysNum) || daysNum <= 0) {
      setError('Please enter a valid delivery period in days.');
      return;
    }

    startTransition(async () => {
      const result = await generateCustomOfferAction(inquiryId, priceNum, daysNum, note);
      if (!result.success) {
        setError(result.error);
      } else {
        setSuccess(true);
        setPrice('');
        setDeliveryDays('');
        setNote('');
        setTimeout(() => {
          setSuccess(false);
          setIsOpen(false);
          router.refresh();
        }, 1500);
      }
    });
  };

  if (!isOpen) {
    return (
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shadow-sm animate-fadeIn">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="text-sm">⚡</span>
          <span>Inquiry active: Propose a custom item with single-click checkout.</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
        >
          Generate Custom Offer
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 border-b border-slate-200 bg-slate-50/50 transition-all duration-300 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
          <span>⚡</span> Generate Custom Offer Proposal
        </h4>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Offer Price (INR)
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-xs font-semibold text-slate-500">₹</span>
              </div>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2499"
                disabled={isPending}
                required
                min="1"
                className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-1.5 text-sm text-slate-800 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Delivery Period (Days)
            </label>
            <input
              type="number"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              placeholder="5"
              disabled={isPending}
              required
              min="1"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Proposal Terms / Custom Details
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Outline exactly what you will create, dimensions, material, and revision details..."
            rows={3}
            disabled={isPending}
            maxLength={1000}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            ⚠️ {error}
          </p>
        )}

        {success && (
          <p className="text-xs font-semibold text-green-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            ✓ Custom offer generated and sent successfully!
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm px-4 py-2 text-xs font-bold transition disabled:opacity-50"
          >
            {isPending ? 'Generating...' : 'Send Custom Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
}
