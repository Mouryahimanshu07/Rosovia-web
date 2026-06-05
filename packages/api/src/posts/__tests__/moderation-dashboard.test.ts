import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listPostsForCreatorProfile } from '../post.repository';
import { listCurrentCreatorListings } from '../../listings/listing.repository';
import { getDatabaseClients } from '@rosovia/integrations';

// Mock getDatabaseClients
vi.mock('@rosovia/integrations', () => ({
  getDatabaseClients: vi.fn(),
}));

describe('Creator Moderation Dashboard: Fetching Admin Notes', () => {
  let mockSupabase: any;
  let mockServiceRoleClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup service role client mock
    mockServiceRoleClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'admin_actions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  target_id: 'post-1',
                  note: 'Rejected due to low image quality',
                  created_at: new Date('2026-06-02').toISOString(),
                },
                {
                  target_id: 'listing-1',
                  note: 'Rejected: Listing description lacks necessary details',
                  created_at: new Date('2026-06-03').toISOString(),
                },
              ],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(getDatabaseClients).mockReturnValue({
      master: mockServiceRoleClient,
      replica: mockServiceRoleClient,
    });

    // Mock regular supabase client for creator
    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_posts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'post-1',
                  creator_profile_id: 'creator-123',
                  caption: 'My painting',
                  post_type: 'image',
                  visibility: 'public',
                  moderation_status: 'rejected',
                  like_count: 0,
                  save_count: 0,
                  view_count: 0,
                  created_at: new Date('2026-06-01').toISOString(),
                  creator_profiles: {
                    id: 'creator-123',
                    display_name: 'Artist Jane',
                    slug: 'jane',
                    profile_image_url: null,
                    is_verified: true,
                    verification_level: 'basic',
                  },
                  creator_post_media: [],
                  listings: null,
                },
              ],
              error: null,
            }),
          };
        }
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'listing-1',
                  creator_id: 'creator-123',
                  category_id: 'cat-abc',
                  listing_type: 'product',
                  title: 'Custom Vase',
                  slug: 'custom-vase',
                  description: 'Beautiful clay vase',
                  price: 1500,
                  currency: 'INR',
                  status: 'rejected',
                  verification_status: 'unverified',
                  metadata: {},
                  created_at: new Date('2026-06-01').toISOString(),
                  categories: { name: 'Clay Art' },
                },
              ],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };
  });

  it('listPostsForCreatorProfile fetches and maps the latest admin action note', async () => {
    const result = await listPostsForCreatorProfile(mockSupabase as SupabaseClient, 'creator-123');

    // Assert it queries creator_posts
    expect(mockSupabase.from).toHaveBeenCalledWith('creator_posts');

    // Assert it queries admin_actions with service role client
    expect(mockServiceRoleClient.from).toHaveBeenCalledWith('admin_actions');

    // Assert the mapped post includes the moderation_note
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe('post-1');
    expect(result.data[0]!.moderation_note).toBe('Rejected due to low image quality');
  });

  it('listCurrentCreatorListings fetches and maps the latest admin action note', async () => {
    const result = await listCurrentCreatorListings(mockSupabase as SupabaseClient, 'creator-123');

    // Assert it queries listings
    expect(mockSupabase.from).toHaveBeenCalledWith('listings');

    // Assert it queries admin_actions with service role client
    expect(mockServiceRoleClient.from).toHaveBeenCalledWith('admin_actions');

    // Assert the mapped listing includes the moderation_note
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('listing-1');
    expect(result[0]!.moderation_note).toBe('Rejected: Listing description lacks necessary details');
  });
});
