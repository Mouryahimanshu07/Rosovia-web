'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@rosovia/core';
import { deletePortfolioItemAction } from '~/app/actions/portfolio';
import { Trash2, Loader2, Play } from 'lucide-react';

interface PortfolioListProps {
  initialItems: MediaAsset[];
}

export function PortfolioList({ initialItems }: PortfolioListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<MediaAsset[]>(initialItems);

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this portfolio item?')) return;

    setDeletingId(id);
    startTransition(async () => {
      const res = await deletePortfolioItemAction(id);
      if (res.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        router.refresh();
      } else {
        alert(res.error ?? 'Failed to delete item');
      }
      setDeletingId(null);
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
        <div className="text-4xl mb-4">🎨</div>
        <p className="text-sm font-semibold text-gray-700">No portfolio items yet</p>
        <p className="text-xs text-gray-500 mt-1 mb-6">
          Upload media showcasing your best work to exhibit on your public profile.
        </p>
        <a
          href="/dashboard/portfolio/new"
          className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition shadow-sm"
        >
          Add Your First Item
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {items.map((item) => {
        let title = '';
        let description = '';
        if (item.alt_text) {
          try {
            const parsed = JSON.parse(item.alt_text);
            if (parsed && typeof parsed === 'object') {
              title = parsed.title || '';
              description = parsed.description || '';
            }
          } catch {
            title = item.alt_text;
          }
        }

        const isVideo = item.media_type === 'video' || item.mime_type.startsWith('video/');

        return (
          <div
            key={item.id}
            className="flex flex-col justify-between bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition duration-300"
          >
            {/* Media Area */}
            <div className="aspect-square bg-gray-950 relative w-full overflow-hidden flex items-center justify-center">
              {item.public_url ? (
                isVideo ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-gray-900">
                    {item.thumbnail_url ? (
                      <Image
                        src={item.thumbnail_url}
                        alt={title || 'video preview'}
                        fill
                        unoptimized
                        className="object-cover opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <span className="text-4xl text-gray-700">🎥</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow">
                        <Play className="h-4 w-4 text-gray-900 fill-gray-900 ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={item.public_url}
                    alt={title || 'portfolio asset'}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                )
              ) : (
                <div className="text-gray-400 text-sm">Media URL missing</div>
              )}
            </div>

            {/* Details Area */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1 text-left">
                <h4 className="font-bold text-gray-900 text-sm line-clamp-1">
                  {title || 'Untitled Work'}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {description || 'No description provided.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {isVideo ? 'Video' : 'Image'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-650 hover:text-red-700 disabled:opacity-50 transition active:scale-95"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
