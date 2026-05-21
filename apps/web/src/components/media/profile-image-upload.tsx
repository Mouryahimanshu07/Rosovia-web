'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MediaUpload } from './media-upload';
import type { MediaAsset } from '@rosovia/core';

interface ProfileImageUploadProps {
  currentUrl: string | null;
}

export function ProfileImageUpload({ currentUrl }: ProfileImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  const handleUploaded = (media: MediaAsset) => {
    if (media.public_url) setPreviewUrl(media.public_url);
  };

  return (
    <div className="flex items-center gap-6">
      {/* Avatar preview */}
      <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
        {previewUrl ? (
          <Image src={previewUrl} alt="Profile image" fill unoptimized className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
            👤
          </div>
        )}
      </div>

      <div className="flex-1">
        <MediaUpload
          usage="profile_image"
          currentUrl={null} /* suppress duplicate preview */
          onUploaded={handleUploaded}
          label="Change photo"
          isPrivate={false}
        />
        <p className="text-xs text-gray-400 mt-1">
          JPEG, PNG, or WebP. Max 5 MB. Profile image is public.
        </p>
      </div>
    </div>
  );
}
