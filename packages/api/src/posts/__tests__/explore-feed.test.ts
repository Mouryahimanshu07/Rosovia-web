import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listPublicWorkFeedPosts } from '../post.repository';

describe('Public Work Feed Filtering and Sorting Tests', () => {
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
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'post-1',
            creator_profile_id: 'creator-123',
            caption: 'Awesome pottery',
            post_type: 'image',
            visibility: 'public',
            moderation_status: 'approved',
            like_count: 10,
            save_count: 5,
            view_count: 100,
            created_at: new Date('2026-06-01').toISOString(),
            creator_profiles: {
              id: 'creator-123',
              display_name: 'Jane Potter',
              slug: 'jane-potter',
              user_id: 'user-123',
              is_verified: false,
              verification_level: 'none',
              profiles: {
                username: 'janepotter',
                status: 'active',
                deleted_at: null,
              },
            },
            creator_post_media: [],
            listings: null,
            post_likes: [],
            post_saves: [],
          },
        ],
        error: null,
      }),
    };

    mockSupabase = {
      rpc: rpcMock,
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_posts') {
          return {
            select: vi.fn().mockReturnValue(queryChain),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
  });

  it('queries database with approved public status constraints', async () => {
    const res = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
      search_query: null,
      category_slug: null,
      sort_by: 'newest',
      post_type_filter: null,
      media_type_filter: null,
      verified_only: false,
    }));
    expect(mockSupabase.from).toHaveBeenCalledWith('creator_posts');
    expect(queryChain.in).toHaveBeenCalledWith('id', ['post-1']);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.id).toBe('post-1');
  });

  it('filters by postType correctly', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      postType: 'portfolio',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
      post_type_filter: 'portfolio',
    }));
  });

  it('resolves category slug and filters by category using OR query', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      category: 'clay-art',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
      category_slug: 'clay-art',
    }));
  });

  it('returns empty results if category slug does not resolve', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    const res = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      category: 'non-existent-category',
    });

    expect(res.data).toHaveLength(0);
    expect(res.hasNext).toBe(false);
  });

  it('sorts by newest/latest by ordering by created_at desc', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      sort: 'latest',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
      sort_by: 'latest',
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

  it('applies query q parameter to match against caption, display_name, listing title, and creator username', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      q: 'handcrafted',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_work_feed_ids', expect.objectContaining({
      search_query: 'handcrafted',
    }));
  });
});
