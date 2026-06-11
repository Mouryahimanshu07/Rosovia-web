import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listPublicWorkFeedPosts } from '../post.repository';

describe('Public Work Feed Filtering and Sorting Tests', () => {
  let mockSupabase: any;
  let queryChain: any;

  beforeEach(() => {
    vi.clearAllMocks();

    queryChain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
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
            },
            creator_post_media: [],
            listings: null,
          },
        ],
        error: null,
      }),
    };

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_posts') {
          return {
            select: vi.fn().mockReturnValue(queryChain),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => {
              return Promise.resolve({
                data: { id: 'cat-uuid-123', slug: 'clay-art' },
                error: null,
              });
            }),
          };
        }
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              return Promise.resolve({
                data: [{ id: 'creator-uuid-123' }],
                error: null,
              });
            }),
          };
        }
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              return Promise.resolve({
                data: [{ id: 'listing-uuid-123' }],
                error: null,
              });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };
  });

  it('queries database with approved public status constraints', async () => {
    const res = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient);

    expect(mockSupabase.from).toHaveBeenCalledWith('creator_posts');
    expect(queryChain.eq).toHaveBeenCalledWith('visibility', 'public');
    expect(queryChain.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    expect(queryChain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.id).toBe('post-1');
  });

  it('filters by postType correctly', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      postType: 'portfolio',
    });

    expect(queryChain.eq).toHaveBeenCalledWith('post_type', 'portfolio');
  });

  it('resolves category slug and filters by category using OR query', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      category: 'clay-art',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('categories');
    expect(queryChain.or).toHaveBeenCalledWith(
      'creator_profile_id.in.(creator-uuid-123),listing_id.in.(listing-uuid-123)'
    );
  });

  it('returns empty results if category slug does not resolve', async () => {
    // Override categories to simulate slug not found
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        };
      }
      if (table === 'creator_posts') {
        return {
          select: vi.fn().mockReturnValue(queryChain),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

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

    expect(queryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('sorts by popular by ordering by like, save, comment, and view counters desc', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      sort: 'popular',
    });

    expect(queryChain.order).toHaveBeenNthCalledWith(1, 'like_count', { ascending: false });
    expect(queryChain.order).toHaveBeenNthCalledWith(2, 'save_count', { ascending: false });
    expect(queryChain.order).toHaveBeenNthCalledWith(3, 'comment_count', { ascending: false });
    expect(queryChain.order).toHaveBeenNthCalledWith(4, 'view_count', { ascending: false });
    expect(queryChain.order).toHaveBeenNthCalledWith(5, 'created_at', { ascending: false });
  });

  it('applies query q parameter to match against caption, display_name, listing title, and creator username', async () => {
    await listPublicWorkFeedPosts(mockSupabase as SupabaseClient, {
      q: 'handcrafted',
    });

    expect(queryChain.or).toHaveBeenCalledWith(
      'caption.ilike.%handcrafted%,creator_profiles.display_name.ilike.%handcrafted%,listings.title.ilike.%handcrafted%,creator_profiles.profiles.username.ilike.%handcrafted%'
    );
  });
});
