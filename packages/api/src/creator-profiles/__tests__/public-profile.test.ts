import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listCreatorPublicListings } from '../../listings/listing.repository';
import { listCreatorPublicPortfolioMedia } from '../../media/media.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Public Creator Profile Queries', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
  });

  describe('listCreatorPublicListings', () => {
    it('queries approved and non-deleted listings for the creator', async () => {
      const mockListings = [
        {
          id: 'listing_1',
          creator_id: 'creator_123',
          title: 'Clay Vase Painting Service',
          status: 'approved',
          deleted_at: null,
          categories: { name: 'Art' },
          creator_profiles: { display_name: 'Jane Doe', slug: 'jane-doe' },
        },
      ];

      mockSupabase.range.mockResolvedValueOnce({
        data: mockListings,
        error: null,
      });

      const result = await listCreatorPublicListings(
        mockSupabase as SupabaseClient,
        'creator_123'
      );

      // Verify query builder called with correct filters
      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase.eq).toHaveBeenCalledWith('creator_id', 'creator_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Clay Vase Painting Service');
      expect(result[0]?.creator_display_name).toBe('Jane Doe');
    });

    it('propagates error when database query fails', async () => {
      mockSupabase.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database query failed' },
      });

      await expect(
        listCreatorPublicListings(mockSupabase as SupabaseClient, 'creator_123')
      ).rejects.toThrow('Failed to list creator public listings: Database query failed');
    });
  });

  describe('listCreatorPublicPortfolioMedia', () => {
    it('queries non-private, ready/uploaded media assets not attached to any listing', async () => {
      const mockMedia = [
        {
          id: 'media_1',
          owner_id: 'profile_123',
          is_private: false,
          status: 'ready',
          listing_id: null,
          storage_key: 'public/profiles/profile_123/img.jpg',
        },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockMedia,
        error: null,
      });

      const result = await listCreatorPublicPortfolioMedia(
        mockSupabase as SupabaseClient,
        'profile_123'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('media_assets');
      expect(mockSupabase.eq).toHaveBeenCalledWith('owner_id', 'profile_123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_private', false);
      expect(mockSupabase.in).toHaveBeenCalledWith('status', ['approved', 'uploaded']);
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
      expect(mockSupabase.is).toHaveBeenCalledWith('listing_id', null);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('media_1');
    });

    it('propagates error when media database query fails', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Media fetch failed' },
      });

      await expect(
        listCreatorPublicPortfolioMedia(mockSupabase as SupabaseClient, 'profile_123')
      ).rejects.toThrow('Failed to list creator public portfolio media: Media fetch failed');
    });
  });
});
