'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportCreateSchema, REPORT_REASONS } from '@rosovia/core';
import type { ReportCreateSchemaInput, ReportTargetType } from '@rosovia/core';
import { createReportAction } from '~/app/actions/reports';
import { Button } from '@rosovia/ui';

interface ReportFormProps {
  targetType: ReportTargetType;
  targetId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam or malicious content',
  scam: 'Scam or fraud',
  harassment: 'Harassment or bullying',
  inappropriate_content: 'Inappropriate content',
  fake_profile: 'Fake or impersonating profile',
  misleading_listing: 'Misleading listing',
  payment_issue: 'Payment or fulfillment issue',
  abusive_review: 'Abusive or fake review',
  other: 'Other',
};

export function ReportForm({ targetType, targetId, onSuccess, onCancel }: ReportFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReportCreateSchemaInput>({
    resolver: zodResolver(reportCreateSchema),
    defaultValues: {
      targetType,
      targetId,
      reason: 'spam',
    },
  });

  const onSubmit = async (data: ReportCreateSchemaInput) => {
    setServerError(null);
    const result = await createReportAction(data);

    if (result.success) {
      onSuccess?.();
    } else {
      setServerError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Reason for report</label>
        <select
          id="reason"
          {...register('reason')}
          className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        >
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REASON_LABELS[reason]}
            </option>
          ))}
        </select>
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Additional Details (Optional)</label>
        <textarea
          id="description"
          rows={4}
          placeholder="Please provide any extra context to help us review..."
          {...register('description')}
          className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
