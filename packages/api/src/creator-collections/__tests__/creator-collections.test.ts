import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionById,
  getCollectionBySlug,
  listCollectionsForCreator,
  addCollectionItem,
  removeCollectionItem,
  listCollectionItems,
} from '../creator-collection.repository';
import {
  createCollectionForCreator,
  updateCollectionForCreator,
  deleteCollectionForCreator,
  addListingToCollection,
  removeListingFromCollection,
  listCollectionsForPublicProfile,
  listCollectionsForCreatorDashboard,
} from '../creator-collection.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../../creator-profiles/creator-profile.repository';
import { getListingById } from '../../listings/listing.repository';

// Mock other repositories
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  getCreatorProfileByUserId: vi.fn(),
}));

vi.mock('../../listings/listing.repository', () => ({
  getListingById: vi.fn(),
}));

describe('Creator Collections Repository & Service', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      auth: {
        getUser: vi.fn(),
      },
    };
  });

  describe('Repository - createCollection', () => {
    it('creates a collection row', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'coll_1', creator_id: 'creator_1', name: 'Pottery Showcase', slug: 'pottery-showcase' },
        error: null,
      });

      const res = await createCollection(
        mockSupabase as SupabaseClient,
        'creator_1',
        'Pottery Showcase',
        'pottery-showcase',
        'Beautiful pots'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('creator_collections');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        creator_id: 'creator_1',
        name: 'Pottery Showcase',
        slug: 'pottery-showcase',
        description: 'Beautiful pots',
      });
      expect(res.name).toBe('Pottery Showcase');
    });
  });

  describe('Service - createCollectionForCreator', () => {
    it('throws if not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(
        createCollectionForCreator(mockSupabase as SupabaseClient, 'Pottery Showcase', 'Beautiful pots')
      ).rejects.toThrow('Not authenticated');
    });

    it('creates a collection successfully for active creator', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_1' } },
        error: null,
      });

      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_1',
        auth_user_id: 'auth_user_1',
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: 'creator_profile_1',
        user_id: 'profile_1',
      } as any);

      // getCollectionBySlug checks during buildUniqueCollectionSlug
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null, // slug not taken
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'coll_1', creator_id: 'creator_profile_1', name: 'Pottery Showcase', slug: 'pottery-showcase' },
        error: null,
      });

      const res = await createCollectionForCreator(
        mockSupabase as SupabaseClient,
        'Pottery Showcase',
        'Beautiful pots'
      );

      expect(res.slug).toBe('pottery-showcase');
      expect(res.creator_id).toBe('creator_profile_1');
    });

    it('generates sequential slugs on duplicate', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_1' } },
        error: null,
      });

      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_1',
        auth_user_id: 'auth_user_1',
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: 'creator_profile_1',
        user_id: 'profile_1',
      } as any);

      // mock slug pottery-showcase exists, but pottery-showcase-2 is free
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'coll_1' }, error: null }) // pottery-showcase exists
        .mockResolvedValueOnce({ data: null, error: null }); // pottery-showcase-2 free

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'coll_2', creator_id: 'creator_profile_1', name: 'Pottery Showcase', slug: 'pottery-showcase-2' },
        error: null,
      });

      const res = await createCollectionForCreator(
        mockSupabase as SupabaseClient,
        'Pottery Showcase',
        'Beautiful pots'
      );

      expect(res.slug).toBe('pottery-showcase-2');
    });

    it('throws if profile is suspended', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_1' } },
        error: null,
      });

      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_1',
        auth_user_id: 'auth_user_1',
        status: 'suspended',
        role: 'creator',
      } as any);

      await expect(
        createCollectionForCreator(mockSupabase as SupabaseClient, 'Pottery Showcase', 'Beautiful pots')
      ).rejects.toThrow('Creator account is suspended');
    });
  });

  describe('Service - addListingToCollection', () => {
    it('throws if creator tries to add a listing belonging to another creator', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_1' } },
        error: null,
      });

      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_1',
        auth_user_id: 'auth_user_1',
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: 'creator_profile_1',
        user_id: 'profile_1',
      } as any);

      // getCollectionById check (ownership check)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'coll_1', creator_id: 'creator_profile_1' },
        error: null,
      });

      // getListingById check
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: 'listing_1',
        creator_id: 'creator_profile_2', // OTHER CREATOR
      } as any);

      await expect(
        addListingToCollection(mockSupabase as SupabaseClient, 'coll_1', 'listing_1')
      ).rejects.toThrow('Not authorized to add this listing: ownership mismatch');
    });

    it('adds listing successfully if owned by the creator', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_1' } },
        error: null,
      });

      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_1',
        auth_user_id: 'auth_user_1',
        status: 'active',
        role: 'creator',
      } as any);

      vi.mocked(getCreatorProfileByUserId).mockResolvedValueOnce({
        id: 'creator_profile_1',
        user_id: 'profile_1',
      } as any);

      // getCollectionById check (ownership check)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'coll_1', creator_id: 'creator_profile_1' },
        error: null,
      });

      // getListingById check
      vi.mocked(getListingById).mockResolvedValueOnce({
        id: 'listing_1',
        creator_id: 'creator_profile_1', // SAME CREATOR
      } as any);

      // insert collection item
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      await expect(
        addListingToCollection(mockSupabase as SupabaseClient, 'coll_1', 'listing_1')
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('collection_items');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        collection_id: 'coll_1',
        listing_id: 'listing_1',
        sort_order: 0,
      });
    });
  });

  describe('Service - listCollectionsForPublicProfile', () => {
    it('filters out draft/unapproved listings in public view', async () => {
      // listCollectionsForCreator
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          { id: 'coll_1', creator_id: 'creator_profile_1', name: 'Showcase 1', slug: 'showcase-1' }
        ],
        error: null,
      });

      // listCollectionItems
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            id: 'item_1',
            collection_id: 'coll_1',
            listing_id: 'listing_approved',
            listings: { id: 'listing_approved', status: 'approved', deleted_at: null }
          },
          {
            id: 'item_2',
            collection_id: 'coll_1',
            listing_id: 'listing_draft',
            listings: { id: 'listing_draft', status: 'draft', deleted_at: null }
          }
        ],
        error: null,
      });

      const res = await listCollectionsForPublicProfile(mockSupabase as SupabaseClient, 'creator_profile_1');

      expect(res).toHaveLength(1);
      expect(res[0]?.items).toHaveLength(1);
      expect(res[0]?.items[0]?.listing_id).toBe('listing_approved');
    });
  });
});
