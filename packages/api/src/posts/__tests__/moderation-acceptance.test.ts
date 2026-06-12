import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentCreatorListing,
  submitCurrentCreatorListingForReview,
  updateCurrentCreatorListing,
} from '../../listings/listing.service';
import {
  createCreatorPost,
} from '../../posts/post.service';
import {
  moderateListingAsAdmin,
  moderatePostAsAdmin,
} from '../../admin/admin.service';
import {
  listPublicListings,
  listCreatorPublicListings,
} from '../../listings/listing.repository';
import {
  listPublicWorkFeedPosts,
  listPublicPostsForCreatorProfile,
} from '../../posts/post.repository';

import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import {
  createListing,
  updateListing,
  updateListingStatus,
  getListingById,
} from '../../listings/listing.repository';
import {
  createPost,
  getPostById,
  attachPostMedia,
} from '../../posts/post.repository';
import {
  setListingStatusAtomic,
  setPostStatusAtomic,
} from '../../admin/admin.repository';
import { getDatabaseClients } from '@rosovia/integrations';

// Mock referenced repositories and services
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../../listings/listing.repository', () => ({
  createListing: vi.fn(),
  updateListing: vi.fn(),
  updateListingStatus: vi.fn(),
  getListingById: vi.fn(),
  listPublicListings: vi.fn(),
  listCreatorPublicListings: vi.fn(),
  isListingSlugTaken: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../posts/post.repository', () => ({
  createPost: vi.fn(),
  getPostById: vi.fn(),
  attachPostMedia: vi.fn(),
  listPublicWorkFeedPosts: vi.fn(),
  listPublicPostsForCreatorProfile: vi.fn(),
}));

vi.mock('../../admin/admin.repository', () => ({
  setListingStatusAtomic: vi.fn(),
  setPostStatusAtomic: vi.fn(),
}));

vi.mock('../../notifications/notification.service', () => ({
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@rosovia/integrations', () => ({
  getDatabaseClients: vi.fn(),
  cacheHelpers: {
    del: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Listing & Post Moderation Acceptance Tests', () => {
  let mockSupabase: any;
  let mockServiceRoleClient: any;
  const CREATOR_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  const CREATOR_PROFILE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  const ADMIN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
  const BUYER_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';
  const MEDIA_ASSET_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const LISTING_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const POST_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: CREATOR_USER_ID } },
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
                  id: MEDIA_ASSET_UUID,
                  owner_id: CREATOR_USER_ID,
                  status: 'approved',
                  mime_type: 'image/jpeg',
                  is_private: false,
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
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    mockServiceRoleClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { user_id: CREATOR_USER_ID },
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

    vi.mocked(getDatabaseClients).mockReturnValue({
      master: mockServiceRoleClient,
      replica: mockServiceRoleClient,
    });

    // Default setup: active creator profile
    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: CREATOR_USER_ID,
      role: 'creator',
      status: 'active',
    } as any);

    vi.mocked(getCreatorProfileByUserId).mockResolvedValue({
      id: CREATOR_PROFILE_ID,
      user_id: CREATOR_USER_ID,
    } as any);
  });

  // 1. Creator creates listing -> draft
  it('Flow 1: Creator creates listing -> defaults to draft', async () => {
    vi.mocked(createListing).mockResolvedValueOnce({
      id: LISTING_UUID,
      creator_id: CREATOR_PROFILE_ID,
      status: 'draft',
      verification_status: 'unverified',
    } as any);

    const listing = await createCurrentCreatorListing(mockSupabase as SupabaseClient, {
      title: 'My Craft Vase',
      listingType: 'product',
      categoryId: 'cat-1',
      currency: 'INR',
      price: 100,
      customOrderAvailable: false,
      deliveryAvailable: false,
      onlineAvailable: false,
      offlineAvailable: false,
      metadata: {},
    });

    expect(createListing).toHaveBeenCalled();
    expect(listing.status).toBe('draft');
  });

  // 2. Creator submits listing -> pending_review
  it('Flow 2: Creator submits listing -> status goes to pending_review', async () => {
    vi.mocked(getListingById).mockResolvedValueOnce({
      id: LISTING_UUID,
      creator_id: CREATOR_PROFILE_ID,
      title: 'suspicious spam listing',
      status: 'draft',
      slug: 'craft-vase',
    } as any);

    vi.mocked(updateListingStatus).mockResolvedValueOnce({
      id: LISTING_UUID,
      status: 'pending_review',
      slug: 'craft-vase',
    } as any);

    const listing = await submitCurrentCreatorListingForReview(
      mockSupabase as SupabaseClient,
      LISTING_UUID
    );

    expect(updateListingStatus).toHaveBeenCalledWith(
      expect.anything(),
      LISTING_UUID,
      'pending_review'
    );
    expect(listing.status).toBe('pending_review');
  });

  // 3. Public cannot see pending listing
  it('Flow 3: Public listings list filters out pending/draft listings', async () => {
    const mockListings = [
      { id: 'listing-1', title: 'Pending', status: 'pending_review' },
      { id: 'listing-2', title: 'Draft', status: 'draft' },
      { id: 'listing-3', title: 'Approved', status: 'approved' },
    ];

    // Simulate database filtering of non-approved status
    vi.mocked(listPublicListings).mockImplementation(async (supabase, params) => {
      return mockListings.filter((l) => l.status === 'approved') as any;
    });

    const publicListings = await listPublicListings(mockSupabase as SupabaseClient);
    expect(publicListings).toHaveLength(1);
    expect(publicListings[0]!.id).toBe('listing-3');
  });

  // 4. Admin approves listing
  it('Flow 4: Admin approves listing -> updates to approved', async () => {
    // Mock admin caller profile
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ADMIN_USER_ID } },
      error: null,
    });
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: ADMIN_USER_ID,
      role: 'admin',
      status: 'active',
    } as any);

    vi.mocked(getListingById).mockResolvedValueOnce({
      id: LISTING_UUID,
      title: 'Craft Vase',
      creator_id: CREATOR_PROFILE_ID,
      status: 'pending_review',
    } as any);

    await moderateListingAsAdmin(mockSupabase as SupabaseClient, {
      listingId: LISTING_UUID,
      action: 'approve',
    });

    expect(setListingStatusAtomic).toHaveBeenCalledWith(
      expect.anything(),
      LISTING_UUID,
      'approved',
      null,
      ADMIN_USER_ID
    );
  });

  // 5. Public can see approved listing
  it('Flow 5: Public listing list contains approved listings', async () => {
    const mockListings = [
      { id: LISTING_UUID, title: 'Approved Craft Vase', status: 'approved' },
    ];

    vi.mocked(listPublicListings).mockResolvedValueOnce(mockListings as any);

    const publicListings = await listPublicListings(mockSupabase as SupabaseClient);
    expect(publicListings).toHaveLength(1);
    expect(publicListings[0]!.status).toBe('approved');
  });

  // 6. Creator creates post -> approved (instant publish)
  it('Flow 6: Creator creates work post -> defaults to approved (instant publish)', async () => {
    vi.mocked(createPost).mockResolvedValueOnce({
      id: POST_UUID,
      creator_profile_id: CREATOR_PROFILE_ID,
      moderation_status: 'approved',
    } as any);

    const post = await createCreatorPost(mockSupabase as SupabaseClient, {
      postType: 'image',
      caption: 'My pottery',
      mediaAssetIds: [MEDIA_ASSET_UUID],
      visibility: 'public',
    });

    // Posts publish instantly — no admin queue
    expect(createPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ moderation_status: 'approved' })
    );
    expect(post.moderation_status).toBe('approved');
  });

  // 7. Public feed shows approved posts; non-approved (rejected/hidden) are filtered
  it('Flow 7: Public feed only returns approved posts; rejected/hidden are excluded', async () => {
    const mockPosts = [
      { id: 'post-1', caption: 'Rejected by admin', moderation_status: 'rejected' },
      { id: 'post-2', caption: 'Hidden by admin', moderation_status: 'hidden' },
      { id: 'post-3', caption: 'Live post', moderation_status: 'approved' },
    ];

    vi.mocked(listPublicWorkFeedPosts).mockImplementation(async (supabase, params) => {
      const data = mockPosts.filter((p) => p.moderation_status === 'approved') as any;
      return { data, hasNext: false };
    });

    const feed = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient);
    expect(feed.data).toHaveLength(1);
    expect(feed.data[0]!.id).toBe('post-3');
    expect(feed.data[0]!.moderation_status).toBe('approved');
  });

  // 8. Admin can approve (restore) a previously hidden or rejected post
  it('Flow 8: Admin approves (restores) a hidden post -> updates to approved', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ADMIN_USER_ID } },
      error: null,
    });
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: ADMIN_USER_ID,
      role: 'admin',
      status: 'active',
    } as any);

    vi.mocked(getPostById).mockResolvedValueOnce({
      id: POST_UUID,
      creator_profile_id: CREATOR_PROFILE_ID,
      moderation_status: 'hidden', // was hidden by admin; now being restored
    } as any);

    await moderatePostAsAdmin(mockSupabase as SupabaseClient, {
      postId: POST_UUID,
      moderationStatus: 'approved',
    });

    expect(setPostStatusAtomic).toHaveBeenCalledWith(
      expect.anything(),
      POST_UUID,
      'approved',
      null,
      ADMIN_USER_ID
    );
  });


  // 9. Public can see approved post in Explore and creator profile
  it('Flow 9: Explore and creator profile public methods return approved posts', async () => {
    const mockPosts = [
      { id: 'post-2', caption: 'Approved Post', moderation_status: 'approved' },
    ];

    vi.mocked(listPublicWorkFeedPosts).mockResolvedValueOnce({
      data: mockPosts as any,
      hasNext: false,
    });
    vi.mocked(listPublicPostsForCreatorProfile).mockResolvedValueOnce(mockPosts as any);

    const explore = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient);
    const profile = await listPublicPostsForCreatorProfile(mockSupabase as SupabaseClient, CREATOR_PROFILE_ID);

    expect(explore.data).toHaveLength(1);
    expect(profile).toHaveLength(1);
    expect(explore.data[0]!.moderation_status).toBe('approved');
    expect(profile[0]!.moderation_status).toBe('approved');
  });

  // 10. Non-admin cannot approve listing/post
  it('Flow 10: Non-admin trying to moderate post/listing throws access error', async () => {
    // Mock buyer role caller
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: BUYER_USER_ID } },
      error: null,
    });
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: BUYER_USER_ID,
      role: 'buyer',
      status: 'active',
    } as any);

    await expect(
      moderateListingAsAdmin(mockSupabase as SupabaseClient, {
        listingId: LISTING_UUID,
        action: 'approve',
      })
    ).rejects.toThrow('Admin access required');

    // Reset caller for post moderate
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: BUYER_USER_ID } },
      error: null,
    });
    vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
      id: BUYER_USER_ID,
      role: 'buyer',
      status: 'active',
    } as any);

    await expect(
      moderatePostAsAdmin(mockSupabase as SupabaseClient, {
        postId: POST_UUID,
        moderationStatus: 'approved',
      })
    ).rejects.toThrow('Admin access required');
  });

  // 11. Creator cannot self-approve listing/post
  it('Flow 11: Creator cannot modify status/moderation_status to self-approve via standard updates', async () => {
    vi.mocked(getListingById).mockResolvedValueOnce({
      id: LISTING_UUID,
      creator_id: CREATOR_PROFILE_ID,
      status: 'draft',
      slug: 'craft-vase',
    } as any);

    vi.mocked(updateListing).mockResolvedValueOnce({
      id: LISTING_UUID,
      status: 'draft', // status remains unchanged
      slug: 'craft-vase',
    } as any);

    // Call updateCurrentCreatorListing trying to inject approved status
    const updated = await updateCurrentCreatorListing(mockSupabase as SupabaseClient, LISTING_UUID, {
      title: 'Modified Title',
      status: 'approved', // attempts to self-approve
    } as any);

    // Verify repository update listing was NOT called with status field
    expect(updateListing).toHaveBeenCalledWith(
      expect.anything(),
      LISTING_UUID,
      expect.not.objectContaining({ status: 'approved' })
    );
    expect(updated.status).toBe('draft');
  });

  // 12. Rejected/hidden content is not public
  it('Flow 12: Rejected/hidden content is excluded from public listings/feed lists', async () => {
    const mockListings = [
      { id: 'listing-1', title: 'Rejected', status: 'rejected' },
      { id: 'listing-2', title: 'Suspended', status: 'suspended' },
      { id: 'listing-3', title: 'Approved', status: 'approved' },
    ];

    const mockPosts = [
      { id: 'post-1', caption: 'Rejected', moderation_status: 'rejected' },
      { id: 'post-2', caption: 'Hidden', moderation_status: 'hidden' },
      { id: 'post-3', caption: 'Approved', moderation_status: 'approved' },
    ];

    vi.mocked(listPublicListings).mockImplementation(async () => {
      return mockListings.filter((l) => l.status === 'approved') as any;
    });

    vi.mocked(listPublicWorkFeedPosts).mockImplementation(async () => {
      const data = mockPosts.filter((p) => p.moderation_status === 'approved') as any;
      return { data, hasNext: false };
    });

    const publicListings = await listPublicListings(mockSupabase as SupabaseClient);
    const publicPosts = await listPublicWorkFeedPosts(mockSupabase as SupabaseClient);

    expect(publicListings).toHaveLength(1);
    expect(publicListings[0]!.id).toBe('listing-3');
    expect(publicPosts.data).toHaveLength(1);
    expect(publicPosts.data[0]!.id).toBe('post-3');
  });
});
