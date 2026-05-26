import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isListingSaved,
  isCreatorSaved,
  saveListing,
  unsaveListing,
  saveCreator,
  unsaveCreator,
  listSavedListings,
  listSavedCreators,
} from '../saved-item.repository';
import {
  isListingSavedForUser,
  isCreatorSavedForUser,
  toggleSaveListing,
  toggleSaveCreator,
  listSavedListingsForUser,
  listSavedCreatorsForUser,
} from '../saved-item.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';

// Mock the profiles repository
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

describe('Saved Items Repository and Service', () => {
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
      auth: {
        getUser: vi.fn(),
      },
    };
  });

  // =========================================================================
  // Repository Unit Tests
  // =========================================================================

  describe('Repository - isListingSaved', () => {
    it('returns true if the listing is saved', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'saved_1' },
        error: null,
      });

      const res = await isListingSaved(mockSupabase as SupabaseClient, 'user_123', 'listing_456');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_listings');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('listing_id', 'listing_456');
      expect(res).toBe(true);
    });

    it('returns false if the listing is not saved', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const res = await isListingSaved(mockSupabase as SupabaseClient, 'user_123', 'listing_456');
      expect(res).toBe(false);
    });
  });

  describe('Repository - isCreatorSaved', () => {
    it('returns true if the creator is saved', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'saved_creator_1' },
        error: null,
      });

      const res = await isCreatorSaved(mockSupabase as SupabaseClient, 'user_123', 'creator_456');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_creators');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('creator_profile_id', 'creator_456');
      expect(res).toBe(true);
    });
  });

  describe('Repository - saveListing', () => {
    it('inserts a saved listing row', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      await saveListing(mockSupabase as SupabaseClient, 'user_123', 'listing_456');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_listings');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user_123',
        listing_id: 'listing_456',
      });
    });

    it('gracefully handles unique constraint violations (already saved)', async () => {
      mockSupabase.insert.mockResolvedValueOnce({
        error: { code: '23505', message: 'duplicate key value' },
      });

      await expect(
        saveListing(mockSupabase as SupabaseClient, 'user_123', 'listing_456')
      ).resolves.not.toThrow();
    });
  });

  describe('Repository - unsaveListing', () => {
    it('deletes the saved listing row', async () => {
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase) // first eq('user_id')
        .mockResolvedValueOnce({ error: null }); // second eq('listing_id')

      await unsaveListing(mockSupabase as SupabaseClient, 'user_123', 'listing_456');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_listings');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('listing_id', 'listing_456');
    });
  });

  describe('Repository - listSavedListings', () => {
    it('queries and flattens saved listings with nested details', async () => {
      const mockRows = [
        {
          id: 'save_1',
          user_id: 'user_123',
          listing_id: 'listing_456',
          created_at: '2026-05-22T00:00:00Z',
          listings: {
            id: 'listing_456',
            title: 'Sleek Handmade Wallet',
            listing_type: 'product',
            categories: { name: 'Crafts' },
            creator_profiles: { display_name: 'Artisan Alice', slug: 'artisan-alice' },
          },
        },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });

      const res = await listSavedListings(mockSupabase as SupabaseClient, 'user_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_listings');
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res).toHaveLength(1);
      expect(res[0]?.listings.category_name).toBe('Crafts');
      expect(res[0]?.listings.creator_display_name).toBe('Artisan Alice');
      expect(res[0]?.listings.creator_slug).toBe('artisan-alice');
    });
  });

  // =========================================================================
  // Service / Business Logic Unit Tests
  // =========================================================================

  describe('Service - isListingSavedForUser', () => {
    it('returns true if authenticated and listing is saved', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_123' } },
        error: null,
      });
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_123',
        auth_user_id: 'auth_user_123',
        status: 'active',
        role: 'buyer',
      } as any);
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'saved_1' },
        error: null,
      });

      const res = await isListingSavedForUser(mockSupabase as SupabaseClient, 'listing_456');

      expect(res).toBe(true);
      expect(getProfileByAuthUserId).toHaveBeenCalledWith(mockSupabase, 'auth_user_123');
    });

    it('returns false if user profile is suspended', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'auth_user_123' } },
        error: null,
      });
      vi.mocked(getProfileByAuthUserId).mockResolvedValueOnce({
        id: 'profile_123',
        auth_user_id: 'auth_user_123',
        status: 'suspended',
        role: 'buyer',
      } as any);

      const res = await isListingSavedForUser(mockSupabase as SupabaseClient, 'listing_456');

      expect(res).toBe(false);
    });

    it('returns false if not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const res = await isListingSavedForUser(mockSupabase as SupabaseClient, 'listing_456');
      expect(res).toBe(false);
    });
  });

  describe('Service - toggleSaveListing', () => {
    it('saves a listing if it was not already saved', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth_user_123' } },
        error: null,
      });
      vi.mocked(getProfileByAuthUserId).mockResolvedValue({
        id: 'profile_123',
        auth_user_id: 'auth_user_123',
        status: 'active',
        role: 'buyer',
      } as any);
      // First isListingSaved check -> false
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // Insert mock
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const res = await toggleSaveListing(mockSupabase as SupabaseClient, 'listing_456');

      expect(res).toEqual({ saved: true });
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'profile_123',
        listing_id: 'listing_456',
      });
    });

    it('unsaves a listing if it was already saved', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth_user_123' } },
        error: null,
      });
      vi.mocked(getProfileByAuthUserId).mockResolvedValue({
        id: 'profile_123',
        auth_user_id: 'auth_user_123',
        status: 'active',
        role: 'buyer',
      } as any);
      // First isListingSaved check -> true
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'saved_1' },
        error: null,
      });
      // Delete chaining mock: first eq, second eq
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase) // for check 1
        .mockReturnValueOnce(mockSupabase) // for check 2
        .mockReturnValueOnce(mockSupabase) // for delete 1
        .mockResolvedValueOnce({ error: null }); // for delete 2

      const res = await toggleSaveListing(mockSupabase as SupabaseClient, 'listing_456');

      expect(res).toEqual({ saved: false });
      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });
});
