import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listPublicWorkFeedPosts,
  likePost,
  unlikePost,
  isPostLiked,
  savePost,
  unsavePost,
  isPostSaved,
  addPostComment,
  deletePostComment,
  listPostComments
} from '../post.repository';

describe('Post Engagement and Custom Filters Repository Tests', () => {
  let mockSupabase: any;
  let queryChain: any;
  let rpcMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    rpcMock = vi.fn().mockResolvedValue({
      data: [{ id: 'post-1' }],
      error: null,
    });

    queryChain = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    mockSupabase = {
      rpc: rpcMock,
      from: vi.fn().mockImplementation((table: string) => {
        return queryChain;
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
  });

  // 1. Content Type and Verified Filters Tests
  describe('listPublicWorkFeedPosts Custom Filters', () => {
    it('applies type=video as post_type=short_video filter', async () => {
      await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
        type: 'video',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
        media_type_filter: 'video',
      }));
    });

    it('applies type=image as post_type in array filter', async () => {
      await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
        type: 'image',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
        media_type_filter: 'image',
      }));
    });

    it('filters by verified creators when verified=true', async () => {
      await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
        verified: true,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
        verified_only: true,
      }));
    });

    it('sorts by popular by ordering by like, save, comment, and view counters desc', async () => {
      await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
        sort: 'popular',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
        sort_by: 'popular',
      }));
    });

    it('matches username in query search', async () => {
      await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
        q: 'john',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
        search_query: 'john',
      }));
    });
  });

  // 2. Engagement Actions Tests
  describe('Like Post Repository Helpers', () => {
    it('calls select and maybeSingle on post_likes to check if liked', async () => {
      queryChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'like-1' }, error: null });
      const liked = await isPostLiked(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_likes');
      expect(queryChain.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
      expect(queryChain.eq).toHaveBeenCalledWith('post_id', 'post-1');
      expect(liked).toBe(true);
    });

    it('calls insert on post_likes to like post', async () => {
      await likePost(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_likes');
      expect(queryChain.insert).toHaveBeenCalledWith({ profile_id: 'profile-1', post_id: 'post-1' });
    });

    it('ignores duplicate primary key violations (23505) when liking', async () => {
      queryChain.insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
      
      // Should not throw
      await expect(likePost(mockSupabase as SupabaseClient, 'profile-1', 'post-1')).resolves.not.toThrow();
    });

    it('calls delete on post_likes to unlike post', async () => {
      await unlikePost(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_likes');
      expect(queryChain.delete).toHaveBeenCalled();
      expect(queryChain.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
      expect(queryChain.eq).toHaveBeenCalledWith('post_id', 'post-1');
    });
  });

  describe('Save Post Repository Helpers', () => {
    it('calls select and maybeSingle on post_saves to check if saved', async () => {
      queryChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const saved = await isPostSaved(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_saves');
      expect(saved).toBe(false);
    });

    it('calls insert on post_saves to save post', async () => {
      await savePost(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_saves');
      expect(queryChain.insert).toHaveBeenCalledWith({ profile_id: 'profile-1', post_id: 'post-1' });
    });

    it('calls delete on post_saves to unsave post', async () => {
      await unsavePost(mockSupabase as SupabaseClient, 'profile-1', 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_saves');
      expect(queryChain.delete).toHaveBeenCalled();
    });
  });

  describe('Comment Post Repository Helpers', () => {
    it('queries post_comments and profiles to list comments', async () => {
      queryChain.order.mockResolvedValueOnce({
        data: [
          {
            id: 'comment-1',
            post_id: 'post-1',
            profile_id: 'profile-1',
            body: 'Amazing!',
            created_at: '2026-06-01T00:00:00Z',
            profiles: {
              username: 'jane',
              full_name: 'Jane Doe',
              avatar_url: 'avatar.png',
            },
          },
        ],
        error: null,
      });

      const res = await listPostComments(mockSupabase as SupabaseClient, 'post-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_comments');
      expect(queryChain.eq).toHaveBeenCalledWith('post_id', 'post-1');
      expect(queryChain.eq).toHaveBeenCalledWith('status', 'active');
      expect(res).toHaveLength(1);
      expect(res[0]!.body).toBe('Amazing!');
      expect(res[0]!.username).toBe('jane');
    });

    it('inserts comments into post_comments and returns the detailed comment', async () => {
      queryChain.single.mockResolvedValueOnce({
        data: {
          id: 'comment-2',
          post_id: 'post-1',
          profile_id: 'profile-1',
          body: 'Love this!',
          created_at: '2026-06-02T00:00:00Z',
          profiles: {
            username: 'jane',
            full_name: 'Jane Doe',
            avatar_url: 'avatar.png',
          },
        },
        error: null,
      });

      const comment = await addPostComment(
        mockSupabase as SupabaseClient,
        'profile-1',
        'post-1',
        'Love this!'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('post_comments');
      expect(queryChain.insert).toHaveBeenCalledWith({
        profile_id: 'profile-1',
        post_id: 'post-1',
        body: 'Love this!',
      });
      expect(comment.id).toBe('comment-2');
      expect(comment.body).toBe('Love this!');
    });

    it('deletes comment by id', async () => {
      await deletePostComment(mockSupabase as SupabaseClient, 'comment-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('post_comments');
      expect(queryChain.delete).toHaveBeenCalled();
      expect(queryChain.eq).toHaveBeenCalledWith('id', 'comment-1');
    });
  });
});
