'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import type { MediaUsage } from '@rosovia/core';

interface ProfileImageUploaderProps {
  type: 'avatar' | 'cover';
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
  maxSizeMb?: number;
  displayName?: string;
  categoryName?: string | null;
}

export function ProfileImageUploader({
  type,
  currentUrl,
  onUploaded,
  onError,
  maxSizeMb = 5,
  displayName = 'User',
  categoryName,
}: ProfileImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up temporary object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (tempPreviewUrl) {
        URL.revokeObjectURL(tempPreviewUrl);
      }
    };
  }, [tempPreviewUrl]);

  // Sync with prop updates
  useEffect(() => {
    if (currentUrl) {
      setPreviewUrl(currentUrl);
      if (tempPreviewUrl) {
        URL.revokeObjectURL(tempPreviewUrl);
        setTempPreviewUrl(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl]);

  const triggerFileSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    // 1. Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const msg = 'Unsupported file type. Please upload a JPEG, PNG, or WebP image.';
      setErrorMsg(msg);
      onError?.(msg);
      return;
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      const msg = `File is too large. Maximum allowed size is ${maxSizeMb} MB.`;
      setErrorMsg(msg);
      onError?.(msg);
      return;
    }

    // 2. Generate local object URL for instant preview
    const objectUrl = URL.createObjectURL(file);
    setTempPreviewUrl(objectUrl);
    setPreviewUrl(objectUrl);

    // 3. Perform upload
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const usage: MediaUsage = 'profile_image';
      const mediaType = 'image';

      // Step A: Request signed URL
      const signRes = await fetch('/api/media/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          mediaType,
          usage,
          isPrivate: false,
        }),
      });

      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({ error: 'Upload permission request failed.' }));
        throw new Error(err.error ?? 'Failed to obtain upload authorization.');
      }

      const { signedUrl, storageKey, publicUrl } = await signRes.json();

      // Step B: Upload file directly to Cloudflare R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage service returned status code ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network connection error during upload.')));
        xhr.addEventListener('abort', () => reject(new Error('Upload was aborted.')));

        xhr.send(file);
      });

      // Step C: Complete metadata record
      const completeRes = await fetch('/api/media/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType,
          storageKey,
          sizeBytes: file.size,
          mimeType: file.type,
          isPrivate: false,
          usage,
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({ error: 'Completion handshake failed.' }));
        throw new Error(err.error ?? 'Failed to finalize media registration.');
      }

      const { media } = await completeRes.json();
      if (media?.public_url) {
        setPreviewUrl(media.public_url);
        onUploaded(media.public_url);
      } else if (publicUrl) {
        setPreviewUrl(publicUrl);
        onUploaded(publicUrl);
      } else {
        throw new Error('Media asset public URL could not be resolved.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'File upload failed.';
      setErrorMsg(msg);
      onError?.(msg);
      // Revert preview on failure
      setPreviewUrl(currentUrl ?? null);
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (type === 'cover') {
    return (
      <div className="relative w-full h-36 sm:h-48 bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 group overflow-hidden">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Cover banner preview"
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-72 h-72 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-80 h-80 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
            {categoryName && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-black text-4xl sm:text-6xl tracking-widest pointer-events-none select-none uppercase">
                {categoryName}
              </div>
            )}
          </>
        )}

        {/* Hover Click overlay */}
        <button
          type="button"
          onClick={triggerFileSelect}
          disabled={isUploading}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all duration-200 backdrop-blur-[2px] cursor-pointer w-full h-full border-none outline-none z-10"
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 text-white/90 animate-spin" />
              <p className="text-white text-xs font-bold uppercase tracking-wider">Uploading {uploadProgress}%</p>
            </div>
          ) : (
            <>
              <Camera className="h-7 w-7 text-white/90" />
              <p className="text-white text-xs font-bold uppercase tracking-wider">Change Cover</p>
            </>
          )}
        </button>

        {errorMsg && (
          <div className="absolute bottom-3 left-3 right-3 bg-red-600/90 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow backdrop-blur z-20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="sr-only"
          disabled={isUploading}
        />
      </div>
    );
  }

  // Avatar Uploader
  return (
    <div className="group relative -mt-12 sm:-mt-14 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white shadow-xl border-2 border-white flex-shrink-0 overflow-visible">
      <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-100 relative bg-indigo-50">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Profile avatar preview"
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-black text-indigo-300">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Camera button badge */}
      <button
        type="button"
        onClick={triggerFileSelect}
        disabled={isUploading}
        className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center shadow-md z-20 cursor-pointer hover:bg-indigo-700 transition-colors border-none outline-none"
        title="Change Profile Photo"
      >
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5 text-white" />
        )}
      </button>

      {errorMsg && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2.5 py-1 rounded shadow whitespace-nowrap z-30">
          {errorMsg}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        disabled={isUploading}
      />
    </div>
  );
}
