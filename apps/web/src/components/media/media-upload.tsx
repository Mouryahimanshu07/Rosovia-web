'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import type { MediaUsage, MediaType, MediaAsset } from '@rosovia/core';
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES, ALLOWED_DOCUMENT_MIME_TYPES, MAX_SIZE } from '@rosovia/core';

// ---------------------------------------------------------------------------
// Allowed types per usage (client-side validation)
// ---------------------------------------------------------------------------

function getAllowedMimeTypes(usage: MediaUsage, accept?: string): string[] {
  if (accept) return [accept];
  switch (usage) {
    case 'profile_image':
      return [...ALLOWED_IMAGE_MIME_TYPES];
    case 'listing_media':
      return [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];
    case 'verification_document':
      return [...ALLOWED_DOCUMENT_MIME_TYPES];
    default:
      return [...ALLOWED_IMAGE_MIME_TYPES];
  }
}

function getMaxSizeBytes(usage: MediaUsage, maxSizeBytes?: number): number {
  if (maxSizeBytes !== undefined) return maxSizeBytes;
  switch (usage) {
    case 'profile_image': return MAX_SIZE.profile_image;
    case 'listing_media': return MAX_SIZE.listing_media_video; // worst-case for mixed
    case 'verification_document': return MAX_SIZE.verification_document;
    default: return MAX_SIZE.general;
  }
}

function inferMediaType(mimeType: string): MediaType {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'video';
  return 'document';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MediaUploadProps {
  usage: MediaUsage;
  listingId?: string;
  currentUrl?: string | null;
  onUploaded?: (media: MediaAsset) => void;
  accept?: string;
  maxSizeBytes?: number;
  isPrivate?: boolean;
  label?: string;
}

type UploadState = 'idle' | 'validating' | 'requesting' | 'uploading' | 'completing' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaUpload({
  usage,
  listingId,
  currentUrl,
  onUploaded,
  accept,
  maxSizeBytes,
  isPrivate = false,
  label = 'Upload file',
}: MediaUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowedMimeTypes = getAllowedMimeTypes(usage, accept);
  const maxBytes = getMaxSizeBytes(usage, maxSizeBytes);

  const reset = () => {
    setState('idle');
    setProgress(0);
    setErrorMsg(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setState('validating');

    // ── Client-side validation ──────────────────────────────────────────────
    if (!allowedMimeTypes.includes(file.type)) {
      setErrorMsg(`Unsupported file type: ${file.type}.`);
      setState('error');
      return;
    }
    if (file.size > maxBytes) {
      const mb = (maxBytes / 1024 / 1024).toFixed(0);
      setErrorMsg(`File is too large. Maximum allowed size is ${mb} MB.`);
      setState('error');
      return;
    }

    try {
      // ── Step 1: Request signed URL ─────────────────────────────────────────
      setState('requesting');
      const mediaType = inferMediaType(file.type);

      const signRes = await fetch('/api/media/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          mediaType,
          usage,
          listingId,
          isPrivate,
        }),
      });

      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Failed to get upload URL');
      }

      const { signedUrl, storageKey, publicUrl } = await signRes.json();

      // ── Step 2: Upload directly to R2 ─────────────────────────────────────
      setState('uploading');
      await uploadToR2WithProgress(signedUrl, file, setProgress);

      // ── Step 3: Save metadata ──────────────────────────────────────────────
      setState('completing');
      const completeRes = await fetch('/api/media/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          mediaType,
          storageKey,
          sizeBytes: file.size,
          mimeType: file.type,
          isPrivate,
          usage,
          // publicUrl is NOT sent — server derives it from env var
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({ error: 'Completion failed' }));
        throw new Error(err.error ?? 'Failed to save file metadata');
      }

      const { media } = await completeRes.json();

      // ── Step 4: Update preview ─────────────────────────────────────────────
      if (publicUrl && mediaType === 'image') {
        setPreviewUrl(publicUrl);
      }

      setState('done');
      onUploaded?.(media as MediaAsset);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('error');
    }

    // Reset file input so the same file can be re-selected after error
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Image preview */}
      {previewUrl && (
        <div className="relative w-20 h-20 rounded-full border border-gray-200 overflow-hidden bg-gray-50">
          <Image src={previewUrl} alt="Preview" fill unoptimized className="object-cover" />
        </div>
      )}

      {/* File input + button */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md border text-sm font-medium transition
          ${state === 'uploading' || state === 'requesting' || state === 'completing'
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'}`}>
          <span>{label}</span>
          <input
            ref={fileRef}
            type="file"
            accept={allowedMimeTypes.join(',')}
            className="sr-only"
            disabled={['validating', 'requesting', 'uploading', 'completing'].includes(state)}
            onChange={handleFileChange}
          />
        </label>

        {/* State indicator */}
        {state === 'uploading' && (
          <span className="text-sm text-gray-500">
            Uploading… {progress}%
          </span>
        )}
        {state === 'requesting' && <span className="text-sm text-gray-400">Preparing…</span>}
        {state === 'completing' && <span className="text-sm text-gray-400">Saving…</span>}
        {state === 'done' && (
          <span className="text-sm text-green-600 font-medium">✓ Uploaded</span>
        )}
        {state === 'error' && (
          <button onClick={reset} className="text-sm text-red-500 hover:underline">Retry</button>
        )}
      </div>

      {/* Progress bar */}
      {state === 'uploading' && (
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-gray-900 h-1.5 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Helper text */}
      <p className="text-xs text-gray-400">
        {allowedMimeTypes.map((t) => t.split('/')[1]?.toUpperCase()).join(', ')} — max {(maxBytes / 1024 / 1024).toFixed(0)} MB
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// XHR upload with progress tracking
// ---------------------------------------------------------------------------

function uploadToR2WithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));

    xhr.send(file);
  });
}
