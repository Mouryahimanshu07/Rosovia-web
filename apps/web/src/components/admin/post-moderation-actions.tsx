'use client';

import { useState } from 'react';
import { moderatePostAction } from '~/app/dashboard/admin/posts/actions';

interface PostModerationActionsProps {
  postId: string;
  currentStatus: 'pending' | 'approved' | 'rejected' | 'hidden';
}

export function PostModerationActions({ postId, currentStatus }: PostModerationActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');

  const act = async (moderationStatus: 'approved' | 'rejected' | 'hidden') => {
    setError(null);
    const result = await moderatePostAction({
      postId,
      moderationStatus,
      note: note.trim() || undefined,
    });
    if (result.success) {
      setStatus(moderationStatus);
      setNote('');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      
      <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason/note (optional)..."
          className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={1.5}
        />
        
        <div className="flex flex-wrap gap-1.5">
          {status !== 'approved' && (
            <button
              onClick={() => {
                if (window.confirm("Approve this post? It will become publicly visible.")) {
                  act('approved');
                }
              }}
              className="inline-flex items-center rounded-md border border-green-200 bg-white px-2 py-1 text-xs font-semibold text-green-700 shadow-sm hover:bg-green-50 transition"
            >
              Approve
            </button>
          )}
          {status !== 'rejected' && (
            <button
              onClick={() => {
                if (window.confirm("Reject this post?")) {
                  act('rejected');
                }
              }}
              className="inline-flex items-center rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 transition"
            >
              Reject
            </button>
          )}
          {status !== 'hidden' && (
            <button
              onClick={() => {
                if (window.confirm("Hide this post?")) {
                  act('hidden');
                }
              }}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
            >
              Hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
