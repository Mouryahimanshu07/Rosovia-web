'use client';

import { useState } from 'react';
import { Heart, Bookmark } from 'lucide-react';
import { toggleSaveListingAction, toggleSaveCreatorAction } from '~/app/actions/saved-items';

interface SaveButtonProps {
  targetType: 'listing' | 'creator';
  targetId: string;
  initialSaved?: boolean;
  className?: string;
}

export function SaveButton({
  targetType,
  targetId,
  initialSaved = false,
  className = '',
}: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    // Prevent event bubbling if mounted in a Link or Clickable card
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);

    try {
      const res =
        targetType === 'listing'
          ? await toggleSaveListingAction(targetId)
          : await toggleSaveCreatorAction(targetId);

      if (res.success && res.data) {
        setSaved(res.data.saved);
      } else {
        console.error('Failed to toggle save:', res.success === false ? res.error : 'Unknown error');
      }
    } catch (err) {
      console.error('Error toggling save status:', err);
    } finally {
      setLoading(false);
    }
  };

  const isListing = targetType === 'listing';

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`group relative flex items-center justify-center p-2 rounded-full border border-gray-100 bg-white/80 hover:bg-white text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-300 shadow-sm ${
        saved
          ? isListing
            ? 'border-indigo-100 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50/70 hover:text-indigo-700'
            : 'border-rose-100 text-rose-600 bg-rose-50/50 hover:bg-rose-50/70 hover:text-rose-700'
          : ''
      } ${className}`}
      title={saved ? `Unsave this ${targetType}` : `Save this ${targetType}`}
      aria-label={saved ? `Unsave ${targetType}` : `Save ${targetType}`}
    >
      {isListing ? (
        <Bookmark
          className={`w-4 h-4 transition-transform group-hover:scale-110 duration-300 ${
            saved ? 'fill-current' : 'fill-transparent'
          }`}
        />
      ) : (
        <Heart
          className={`w-4 h-4 transition-transform group-hover:scale-110 duration-300 ${
            saved ? 'fill-current' : 'fill-transparent'
          }`}
        />
      )}
    </button>
  );
}
