import type { ReportTargetType } from '@rosovia/core';

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
}

export function ReportButton({ targetType, targetId, className = '' }: ReportButtonProps) {
  const mailtoUrl = `mailto:support@rosovia.com?subject=Report%20Abuse%3A%20${targetType}%20(${targetId})&body=Please%20describe%20the%20issue%20with%20this%20${targetType}%20(ID%3A%20${targetId})%3A`;

  return (
    <a
      href={mailtoUrl}
      className={`text-xs font-medium text-gray-500 hover:text-gray-900 underline transition ${className}`}
    >
      Report this {targetType}
    </a>
  );
}
