'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '~/lib/supabase/client';

interface RealtimeBadgeProps {
  initialCount: number;
  profileId: string;
  type: 'notifications' | 'messages';
}

export function RealtimeBadge({ initialCount, profileId, type }: RealtimeBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const table = type === 'notifications' ? 'notifications' : 'messages';
    const channelName = `realtime:badge:${type}:${profileId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          ...(type === 'notifications'
            ? { filter: `recipient_profile_id=eq.${profileId}` }
            : {}),
        },
        (payload: any) => {
          const newRow = payload.new;
          if (type === 'messages') {
            // Only count messages NOT sent by the current user
            if (newRow.sender_profile_id === profileId) return;
          }
          setCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, type]);

  if (count <= 0) return null;

  if (type === 'notifications') {
    return <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500" />;
  }

  return (
    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}
