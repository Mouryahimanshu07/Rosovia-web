import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCreatorPost } from '../post.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import { createPost, attachPostMedia } from '../post.repository';

// Mock repositories & services
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../post.repository', () => ({
  createPost: vi.fn(),
  attachPostMedia: vi.fn(),
  getPostById: vi.fn(),
}));

describe('Post Service Layer: Listing Showcase Validation', () => {
  let mockSupabase: any;
  const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  const CREATOR_PROFILE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
  const MEDIA_ASSET_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const LISTING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock resolveActiveCreatorProfile success by default
    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: USER_ID,
      role: 'creator',
      status: 'active',
    } as any);

    vi.mocked(getCreatorProfileByUserId).mockResolvedValue({
      id: CREATOR_PROFILE_ID,
      user_id: USER_ID,
    } as any);

    // Default media assets mock query
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'media_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: MEDIA_ASSET_ID,
                  owner_id: USER_ID,
                  status: 'approved',
                  mime_type: 'image/jpeg',
                  is_private: false,
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
            single: vi.fn().mockResolvedValue({
              data: {
                id: LISTING_ID,
                creator_id: CREATOR_PROFILE_ID,
                status: 'approved',
              },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };
  });

  it('fails if postType is listing_showcase but listingId is missing', async () => {
    await expect(
      createCreatorPost(mockSupabase as SupabaseClient, {
        postType: 'listing_showcase',
        caption: 'My listing showcase post!',
        visibility: 'public',
        mediaAssetIds: [MEDIA_ASSET_ID],
        listingId: null,
      })
    ).rejects.toThrow('Listing selection is required for a listing showcase post');
  });

  it('fails to showcase listing if listing is not found', async () => {
    // Override listings mock to simulate listing not found
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'media_assets') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: MEDIA_ASSET_ID, owner_id: USER_ID, status: 'approved', mime_type: 'image/jpeg', is_private: false }],
            error: null,
          }),
        };
      }
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    await expect(
      createCreatorPost(mockSupabase as SupabaseClient, {
        postType: 'listing_showcase',
        caption: 'My listing showcase post!',
        visibility: 'public',
        mediaAssetIds: [MEDIA_ASSET_ID],
        listingId: LISTING_ID,
      })
    ).rejects.toThrow('Listing not found');
  });

  it('fails if listing belongs to another creator', async () => {
    // Override listings mock to return a listing with another creator_id
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'media_assets') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: MEDIA_ASSET_ID, owner_id: USER_ID, status: 'approved', mime_type: 'image/jpeg', is_private: false }],
            error: null,
          }),
        };
      }
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: LISTING_ID,
              creator_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', // another creator profile uuid
              status: 'approved',
            },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    await expect(
      createCreatorPost(mockSupabase as SupabaseClient, {
        postType: 'listing_showcase',
        caption: 'My listing showcase post!',
        visibility: 'public',
        mediaAssetIds: [MEDIA_ASSET_ID],
        listingId: LISTING_ID,
      })
    ).rejects.toThrow('Listing does not belong to your creator profile');
  });

  it('fails if listing is not approved (e.g. pending/draft)', async () => {
    // Override listings mock to return a pending listing
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'media_assets') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: MEDIA_ASSET_ID, owner_id: USER_ID, status: 'approved', mime_type: 'image/jpeg', is_private: false }],
            error: null,
          }),
        };
      }
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: LISTING_ID,
              creator_id: CREATOR_PROFILE_ID,
              status: 'pending_review',
            },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    await expect(
      createCreatorPost(mockSupabase as SupabaseClient, {
        postType: 'listing_showcase',
        caption: 'My listing showcase post!',
        visibility: 'public',
        mediaAssetIds: [MEDIA_ASSET_ID],
        listingId: LISTING_ID,
      })
    ).rejects.toThrow('Only approved listings can be showcased in posts');
  });

  it('succeeds and creates showcase post when all validation passes', async () => {
    vi.mocked(createPost).mockResolvedValue({
      id: 'post-789',
      creator_profile_id: CREATOR_PROFILE_ID,
      post_type: 'listing_showcase',
      listing_id: LISTING_ID,
    } as any);

    const post = await createCreatorPost(mockSupabase as SupabaseClient, {
      postType: 'listing_showcase',
      caption: 'My showcase post!',
      visibility: 'public',
      mediaAssetIds: [MEDIA_ASSET_ID],
      listingId: LISTING_ID,
    });

    expect(post).toBeDefined();
    expect(post.id).toBe('post-789');
    expect(createPost).toHaveBeenCalledWith(mockSupabase, expect.objectContaining({
      creator_profile_id: CREATOR_PROFILE_ID,
      post_type: 'listing_showcase',
      listing_id: LISTING_ID,
      moderation_status: 'approved',
    }));
    expect(attachPostMedia).toHaveBeenCalledWith(mockSupabase, 'post-789', [MEDIA_ASSET_ID]);
  });
});
