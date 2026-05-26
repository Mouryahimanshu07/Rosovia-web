import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCurrentCreatorListing,
  updateCurrentCreatorListing,
  submitCurrentCreatorListingForReview,
  archiveCurrentCreatorListing,
} from '../listing.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import {
  getListingById,
  createListing,
  updateListing,
  updateListingStatus,
} from '../listing.repository';

// Mock referenced repositories
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../listing.repository', () => ({
  getListingById: vi.fn(),
  getListingBySlug: vi.fn(),
  isListingSlugTaken: vi.fn().mockResolvedValue(false),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  updateListingStatus: vi.fn(),
}));

describe('Listings Service Layer Permission and Ownership Tests', () => {
  let mockSupabase: any;
  const CREATOR_PROFILE_ID = 'creator-123';
  const LISTING_ID = 'listing-456';

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-123' } },
          error: null,
        }),
      },
    };
  });

  describe('resolveCreatorProfile role guards', () => {
    it('throws error if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(
        createCurrentCreatorListing(mockSupabase as SupabaseClient, {} as any)
      ).rejects.toThrow('Not authenticated');
    });

    it('throws error if user profile is not found', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce(null);

      await expect(
        createCurrentCreatorListing(mockSupabase as SupabaseClient, {} as any)
      ).rejects.toThrow('Profile not found');
    });

    it('throws error if user role is not creator', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile-123',
        role: 'buyer',
        status: 'active',
      } as any);

      await expect(
        createCurrentCreatorListing(mockSupabase as SupabaseClient, {} as any)
      ).rejects.toThrow('Only creators can manage listings');
    });

    it('throws error if user profile is suspended', async () => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile-123',
        role: 'creator',
        status: 'suspended',
      } as any);

      await expect(
        createCurrentCreatorListing(mockSupabase as SupabaseClient, {} as any)
      ).rejects.toThrow('Account is not active');
    });
  });

  describe('assertOwnsListing ownership checks', () => {
    beforeEach(() => {
      // Mock successful creator profile resolve
      vi.mocked(getProfileByAuthUserId).mockResolvedValue({
        id: 'profile-123',
        role: 'creator',
        status: 'active',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValue({
        id: CREATOR_PROFILE_ID,
      } as any);
    });

    it('throws error if listing does not exist', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce(null);

      await expect(
        updateCurrentCreatorListing(mockSupabase as SupabaseClient, LISTING_ID, { categoryId: 'cat-789' })
      ).rejects.toThrow('Listing not found');
    });

    it('throws error if creator does not own the listing', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: LISTING_ID,
        creator_id: 'another-creator-uuid',
      } as any);

      await expect(
        updateCurrentCreatorListing(mockSupabase as SupabaseClient, LISTING_ID, { categoryId: 'cat-789' })
      ).rejects.toThrow('You do not own this listing');
    });

    it('allows updates if creator owns the listing', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: LISTING_ID,
        creator_id: CREATOR_PROFILE_ID,
      } as any);

      vi.mocked(updateListing).mockResolvedValueOnce({ id: LISTING_ID } as any);

      const res = await updateCurrentCreatorListing(mockSupabase as SupabaseClient, LISTING_ID, {
        categoryId: 'cat-789',
        title: 'Updated Clay Pot',
      });

      expect(res).toBeDefined();
      expect(updateListing).toHaveBeenCalledWith(
        mockSupabase,
        LISTING_ID,
        expect.objectContaining({ title: 'Updated Clay Pot' })
      );
    });
  });

  describe('status transition rules', () => {
    beforeEach(() => {
      vi.mocked(getProfileByAuthUserId).mockResolvedValue({
        id: 'profile-123',
        role: 'creator',
        status: 'active',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValue({
        id: CREATOR_PROFILE_ID,
      } as any);
    });

    it('only allows draft listings to be submitted for review', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: LISTING_ID,
        creator_id: CREATOR_PROFILE_ID,
        status: 'approved', // already approved listing
      } as any);

      await expect(
        submitCurrentCreatorListingForReview(mockSupabase as SupabaseClient, LISTING_ID)
      ).rejects.toThrow('Only drafts can be submitted');
    });

    it('allows draft listings to transition to pending_review', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: LISTING_ID,
        creator_id: CREATOR_PROFILE_ID,
        status: 'draft',
      } as any);

      vi.mocked(updateListingStatus).mockResolvedValueOnce({ id: LISTING_ID, status: 'pending_review' } as any);

      const res = await submitCurrentCreatorListingForReview(mockSupabase as SupabaseClient, LISTING_ID);
      expect(res.status).toBe('pending_review');
      expect(updateListingStatus).toHaveBeenCalledWith(mockSupabase, LISTING_ID, 'pending_review');
    });

    it('rejects archiving suspended listings', async () => {
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: LISTING_ID,
        creator_id: CREATOR_PROFILE_ID,
        status: 'suspended',
      } as any);

      await expect(
        archiveCurrentCreatorListing(mockSupabase as SupabaseClient, LISTING_ID)
      ).rejects.toThrow('Suspended listings cannot be archived.');
    });
  });
});
