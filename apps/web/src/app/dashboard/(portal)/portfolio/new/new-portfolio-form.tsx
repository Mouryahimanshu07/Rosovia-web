'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MediaUpload } from '~/components/media/media-upload';
import { updatePortfolioMetadataAction, deletePortfolioItemAction } from '~/app/actions/portfolio';
import type { MediaAsset } from '@rosovia/core';
import { Loader2, ArrowLeft, ImagePlus, Video, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export function NewPortfolioForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemoveMedia = async () => {
    if (!uploadedMedia) return;
    const mediaId = uploadedMedia.id;
    setUploadedMedia(null);
    await deletePortfolioItemAction(mediaId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!uploadedMedia) {
      setError('Please upload an image or video file.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updatePortfolioMetadataAction(uploadedMedia.id, title.trim(), description.trim());
      if (res.success) {
        router.push('/dashboard/portfolio');
        router.refresh();
      } else {
        setError(res.error ?? 'Failed to save portfolio item');
      }
    });
  };

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

        {/* Media Uploader Box */}
        <div className="space-y-3 text-left">
          <label className="text-sm font-semibold text-gray-700">
            Media Showcase File <span className="text-red-500">*</span>
          </label>

          {!uploadedMedia ? (
            <div className="border-2 border-dashed border-gray-250 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-300 transition-all duration-200">
              <ImagePlus className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 text-center mb-4">
                Upload a showcase image (JPEG, PNG, WebP) or video (MP4, WebM)
              </p>
              <MediaUpload
                usage="portfolio"
                accept="image/*,video/*"
                label="Choose file to upload"
                onUploaded={(media) => {
                  setUploadedMedia(media);
                  setError(null);
                }}
              />
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden max-w-sm aspect-square border border-gray-200 bg-gray-100 flex flex-col justify-between shadow-sm group">
              {uploadedMedia.media_type === 'image' && uploadedMedia.public_url ? (
                <Image
                  src={uploadedMedia.public_url}
                  alt="Uploaded portfolio item"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-2 bg-gray-100/90 text-center">
                  <Video className="h-8 w-8 text-indigo-500 mb-1" />
                  <span className="text-xs font-bold text-gray-700 truncate w-full px-4">
                    {uploadedMedia.storage_key.split('/').pop()}
                  </span>
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-650 hover:bg-red-700 text-white shadow transition-all duration-200 active:scale-95"
                title="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-700 text-left">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Link
            href="/dashboard/portfolio"
            className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending || !uploadedMedia || !title.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Item'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
