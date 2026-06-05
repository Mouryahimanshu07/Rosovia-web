import type { CreatorPostWithDetails } from '@rosovia/core';
import { CreatorPostCard } from './CreatorPostCard';
import { LayoutGrid } from 'lucide-react';

interface CreatorPostGridProps {
  posts: CreatorPostWithDetails[];
  showCreator?: boolean;
  emptyMessage?: string;
  isOwnDashboard?: boolean;
}

export function CreatorPostGrid({
  posts,
  showCreator = true,
  emptyMessage = 'No work posts yet.',
  isOwnDashboard = false,
}: CreatorPostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
          <LayoutGrid className="h-8 w-8 text-gray-300" />
        </div>
        <p className="text-sm text-gray-400 max-w-xs">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {posts.map((post) => (
        <CreatorPostCard
          key={post.id}
          post={post}
          showCreator={showCreator}
          isOwnDashboard={isOwnDashboard}
        />
      ))}
    </div>
  );
}
