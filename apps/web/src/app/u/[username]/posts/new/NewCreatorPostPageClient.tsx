'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPostAction } from '~/app/actions/posts';
import { POST_TYPES, type MediaAsset, type PostType } from '@rosovia/core';
import { ArrowLeft, Loader2, X, Video, ImagePlus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { MediaUpload } from '~/components/media/media-upload';

const POST_TYPE_LABELS: Record<string, string> = {
  image: '📷 Image',
  short_video: '🎬 Short Video',
  portfolio: '🎨 Portfolio Case Study',
  listing_showcase: '🏪 Listing Showcase',
  carousel: '🖼️ Carousel (2–10 images)',
};

interface NewCreatorPostPageClientProps {
  username: string;
}

export function NewCreatorPostPageClient({ username }: NewCreatorPostPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [postType, setPostType] = useState<PostType>('image');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);

  // Clear uploaded assets if post type changes to avoid mismatches
  useEffect(() => {
    setUploadedAssets([]);
    setError(null);
  }, [postType]);

  // Determine upload rules based on postType
  let maxFiles = 1;
  let accept = 'image/*';
  let typeDescription = 'Upload a single image.';

  if (postType === 'short_video') {
    maxFiles = 1;
    accept = 'video/*';
    typeDescription = 'Upload a single video.';
  } else if (postType === 'carousel') {
    maxFiles = 10;
    accept = 'image/*,video/*';
    typeDescription = 'Upload between 2 and 10 images or videos.';
  } else if (postType === 'portfolio') {
    maxFiles = 10;
    accept = 'image/*,video/*';
    typeDescription = 'Upload up to 10 images/videos showcasing your project.';
  } else if (postType === 'listing_showcase') {
    maxFiles = 1;
    accept = 'image/*,video/*';
    typeDescription = 'Upload a single image or video for this showcase.';
  }

  const removeAsset = (id: string) => {
    setUploadedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ids = uploadedAssets.map((a) => a.id);

    if (ids.length === 0) {
      setError('Please upload at least one image or video.');
      return;
    }

    if (postType === 'carousel' && ids.length < 2) {
      setError('Carousel posts require at least 2 images/videos.');
      return;
    }

    startTransition(async () => {
      const result = await createPostAction({
        postType,
        caption: caption.trim() || null,
        visibility,
        mediaAssetIds: ids,
      });

      if (result.success) {
        router.push(`/u/${username}/posts`);
      } else {
        setError(result.error ?? 'Failed to create post');
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Back */}
      <Link
        href={`/u/${username}/posts`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to posts
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Share Work Post</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your post will go live after a quick moderation review (usually within 24 hours).
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Post type */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Post Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POST_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition-all duration-200 ${
                  postType === type
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {POST_TYPE_LABELS[type] ?? type}
              </button>
            ))}
          </div>
        </div>

        {/* Media Uploader Box */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700">
              Media Assets <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400 font-medium">
              {uploadedAssets.length} / {maxFiles} files
            </span>
          </div>

          {/* Upload Widget */}
          {uploadedAssets.length < maxFiles ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-300 transition-all duration-200">
              <ImagePlus className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 text-center mb-4">{typeDescription}</p>
              <MediaUpload
                key={`${postType}-${uploadedAssets.length}`}
                usage="post_media"
                accept={accept}
                label="Choose file to upload"
                onUploaded={(asset) => {
                  setUploadedAssets((prev) => [...prev, asset]);
                  setError(null);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-800">
              <span>✓ All media uploaded. To replace, remove files from the preview below.</span>
            </div>
          )}

          {/* Grid Preview of Uploaded Assets */}
          {uploadedAssets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {uploadedAssets.map((asset, index) => (
                <div
                  key={asset.id}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-gray-200 bg-gray-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {asset.media_type === 'image' && asset.public_url ? (
                    <Image
                      src={asset.public_url}
                      alt={`Uploaded preview ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-2 bg-gray-100/90 text-center">
                      <Video className="h-8 w-8 text-indigo-500 mb-1 animate-pulse" />
                      <span className="text-[10px] font-bold text-gray-700 truncate w-full px-2">
                        {asset.storage_key.split('/').pop()}
                      </span>
                    </div>
                  )}

                  {/* Order Tag */}
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[9px] font-bold z-10">
                    {maxFiles > 1 ? `Slide #${index + 1}` : 'Cover'}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeAsset(asset.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200 scale-90 opacity-90 group-hover:scale-100 group-hover:opacity-100"
                    title="Remove media"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <label htmlFor="caption" className="text-sm font-semibold text-gray-700">
            Caption{' '}
            <span className="text-gray-400 font-normal">(optional, max 2200 characters)</span>
          </label>
          <textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            maxLength={2200}
            placeholder="Describe your work, process, or what makes this special…"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder-gray-400 transition-all duration-200"
          />
          <p className="text-xs text-gray-400 text-right">{caption.length} / 2200</p>
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Visibility</label>
          <div className="flex flex-wrap gap-2">
            {(['public', 'followers', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition-all duration-200 ${
                  visibility === v
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {v === 'public' ? '🌐 Public' : v === 'followers' ? '👥 Followers Only' : '🔒 Private'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/u/${username}/posts`}
            className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all duration-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            id="submit-post-btn"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700 shadow-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for Review'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
