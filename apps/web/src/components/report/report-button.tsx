'use client';

import { useState } from 'react';
import type { ReportTargetType } from '@rosovia/core';
import { ReportForm } from './report-form';
import { Button } from '@rosovia/ui';

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
}

export function ReportButton({ targetType, targetId, className = '' }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (isSuccess) {
    return (
      <div className={`text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200 ${className}`}>
        Thank you for your report. Our team will review it shortly.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`text-xs font-medium text-gray-500 hover:text-gray-900 underline transition ${className}`}
      >
        Report this {targetType}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Report {targetType}</h3>
      <ReportForm
        targetType={targetType}
        targetId={targetId}
        onSuccess={() => setIsSuccess(true)}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  );
}
