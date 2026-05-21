'use client';

import { useState } from 'react';
import { Button } from '@rosovia/ui';

interface AdminActionButtonProps {
  label: string;
  onConfirm: () => Promise<void>;
  confirmMessage?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
  requireConfirm?: boolean;
}

export function AdminActionButton({
  label,
  onConfirm,
  confirmMessage,
  variant = 'outline',
  size = 'sm',
  className,
  requireConfirm = true,
}: AdminActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (requireConfirm && confirmMessage) {
      if (!window.confirm(confirmMessage)) return;
    }
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Processing…' : label}
    </Button>
  );
}
