'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MediaUpload } from './media-upload';
import type { MediaAsset } from '@rosovia/core';

interface ListingMediaUploadProps {
  listingId: string;
  existingMedia?: MediaAsset[];
}

export function ListingMediaUpload({ listingId, existingMedia = [] }: ListingMediaUploadProps) {
  const [uploaded, setUploaded] = useState<MediaAsset[]>(existingMedia);

  const handleUploaded = (media: MediaAsset) => {
    setUploaded((prev) => [media, ...prev]);
  };

  const publicImages = uploaded.filter((m) => m.media_type === 'image' && m.public_url);

  return (
    <div className="space-y-4">
      <MediaUpload
        usage="listing_media"
        listingId={listingId}
        onUploaded={handleUploaded}
        label="Upload image"
        isPrivate={false}
      />

      {publicImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {publicImages.map((m) => (
            <div key={m.id} className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <Image src={m.public_url!} alt="Listing image" fill unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {uploaded.length === 0 && (
        <p className="text-xs text-gray-400">No images uploaded yet.</p>
      )}
    </div>
  );
}
