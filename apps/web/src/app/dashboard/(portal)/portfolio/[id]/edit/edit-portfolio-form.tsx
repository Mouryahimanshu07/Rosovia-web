'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updatePortfolioMetadataAction } from '~/app/actions/portfolio';
import { Loader2, ArrowLeft, Play } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface EditPortfolioFormProps {
  mediaId: string;
  initialTitle: string;
  initialDescription: string;
  mediaUrl: string | null;
  mediaType: string;
}

export function EditPortfolioForm({
  mediaId,
  initialTitle,
  initialDescription,
  mediaUrl,
  mediaType,
}: EditPortfolioFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updatePortfolioMetadataAction(mediaId, title.trim(), description.trim());
      if (res.success) {
        router.push('/dashboard/portfolio');
        router.refresh();
      } else {
        setError(res.error ?? 'Failed to update portfolio item');
      }
    });
  };

  const isVideo = mediaType === 'video';

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/portfolio"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Portfolio
      </Link>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-2 text-left">
          <label htmlFor="portfolio-title" className="text-sm font-semibold text-gray-700">
            Work Title <span className="text-red-500">*</span>
          </label>
          <input
            id="portfolio-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Logo Design for Antigravity"
            maxLength={100}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
          />
        </div>

        <div className="space-y-2 text-left">
          <label htmlFor="portfolio-desc" className="text-sm font-semibold text-gray-700">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="portfolio-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell visitors about your process, the tools you used, or the project constraints..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all duration-200"
          />
          <p className="text-xs text-gray-400 text-right">{description.length} / 500</p>
        </div>

        {/* Media Preview Box */}
        <div className="space-y-3 text-left">
          <label className="text-sm font-semibold text-gray-700">Media File</label>
          <div className="relative border border-gray-200 rounded-2xl overflow-hidden aspect-video max-w-md bg-gray-950 flex items-center justify-center">
            {mediaUrl ? (
              isVideo ? (
                <div className="w-full h-full relative flex items-center justify-center bg-gray-900">
                  <video src={mediaUrl} controls className="max-w-full max-h-full" />
                </div>
              ) : (
                <Image
                  src={mediaUrl}
                  alt={title || 'portfolio asset'}
                  fill
                  unoptimized
                  className="object-cover"
                />
              )
            ) : (
              <div className="text-gray-400 text-sm">Media file missing or private</div>
            )}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600 text-left">{error}</p>}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/dashboard/portfolio"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gray-900 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition active:scale-95"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
