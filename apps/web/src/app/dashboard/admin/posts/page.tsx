import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listPostsForAdmin } from '@rosovia/api';
import type { CreatorPostWithDetails } from '@rosovia/core';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';
import { PostModerationActions } from '~/components/admin/post-moderation-actions';

export const metadata: Metadata = {
  title: 'Work Posts — Admin — Rosovia',
};

const STATUS_FILTERS = ['', 'pending', 'approved', 'rejected', 'hidden'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  hidden: 'Hidden',
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const posts = await listPostsForAdmin(supabase, {
    status: searchParams.status || undefined,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Work Posts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Approve, reject, or hide creator work posts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <a
              key={s}
              href={s ? `/dashboard/admin/posts?status=${s}` : '/dashboard/admin/posts'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                (searchParams.status ?? '') === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </a>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No posts found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Media</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creator</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Caption Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Post Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((post: CreatorPostWithDetails) => {
                  const firstMedia = post.media?.[0];
                  return (
                    <tr key={post.id} className="hover:bg-gray-50">
                      {/* Media preview */}
                      <td className="px-4 py-3">
                        {firstMedia ? (
                          <div className="relative w-12 h-12 bg-gray-50 overflow-hidden rounded border border-gray-200 flex items-center justify-center">
                            {firstMedia.media_type === 'video' ? (
                              firstMedia.thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={firstMedia.thumbnail_url}
                                  alt="Video thumbnail"
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <span className="text-[10px] text-gray-500 font-semibold">🎬 Video</span>
                              )
                            ) : firstMedia.public_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={firstMedia.public_url}
                                alt="Post thumbnail"
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <span className="text-xl">🎨</span>
                            )}
                            {post.media.length > 1 && (
                              <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl font-bold">
                                +{post.media.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Creator */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{post.creator_display_name ?? '—'}</div>
                        <div className="text-xs text-gray-500">
                          {(post as any).creator_username ? `@${(post as any).creator_username}` : '—'}
                        </div>
                      </td>

                      {/* Caption */}
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {post.caption ? (
                          <span title={post.caption}>
                            {post.caption.length > 60 ? `${post.caption.slice(0, 60)}...` : post.caption}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">No caption</span>
                        )}
                      </td>

                      {/* Post Type */}
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600 font-medium capitalize">
                          {post.post_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Visibility */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium border capitalize ${
                            post.visibility === 'public'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : post.visibility === 'followers'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {post.visibility}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <AdminStatusBadge status={post.moderation_status} />
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(post.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <PostModerationActions
                          postId={post.id}
                          currentStatus={post.moderation_status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {posts.length === 20 && (
        <div className="flex justify-end">
          <a
            href={`/dashboard/admin/posts?page=${page + 1}${
              searchParams.status ? `&status=${searchParams.status}` : ''
            }`}
            className="text-sm text-indigo-650 hover:text-indigo-550 font-semibold"
          >
            Next page →
          </a>
        </div>
      )}
    </div>
  );
}
