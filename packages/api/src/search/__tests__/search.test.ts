import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  searchApprovedListings,
  searchPublicCreators,
  listActiveCategories,
  getCategoryBySlug,
  getCategoryPageData,
} from '../search.repository';
import {
  getExplorePageData,
  searchListingsForPublicPage,
  searchCreatorsForPublicPage,
  getCategoriesPageData,
  getPublicCategoryDetailPageData,
  getTrendingListings,
} from '../search.service';
import { listPublicListings } from '../../listings/listing.repository';
import { listPublicCreatorProfiles } from '../../creator-profiles/creator-profile.repository';
import { listPublicProfiles } from '../../profiles/profile.repository';

vi.mock('../../listings/listing.repository', () => ({
  listPublicListings: vi.fn(),
}));

vi.mock('../../creator-profiles/creator-profile.repository', () => ({
  listPublicCreatorProfiles: vi.fn(),
  mapProfileRowToCreatorProfile: (row: any) => row,
}));

vi.mock('../../profiles/profile.repository', () => ({
  listPublicProfiles: vi.fn(),
}));

const CATEGORY_ID = 'e3d7bb0d-bbfb-48bb-a084-3c66f578df9e';
const LISTING_ID = 'c5d7943d-0d67-4d04-be3d-49520ea85e78';
const CREATOR_ID = '90886ff0-bc78-4395-9ffb-fa419356cc5c';

describe('Search & Discovery Service & Repository', () => {
  let mockSupabase: any;
  let mockSelect: any;
  let mockEq: any;
  let mockIs: any;
  let mockOrder: any;
  let mockRange: any;
  let mockLimit: any;
  let mockIlike: any;
  let mockGte: any;
  let mockLte: any;
  let mockOr: any;
  let mockSingle: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect = vi.fn().mockReturnThis();
    mockEq = vi.fn().mockReturnThis();
    mockIs = vi.fn().mockReturnThis();
    mockOrder = vi.fn().mockReturnThis();
    mockLimit = vi.fn().mockReturnThis();
    mockIlike = vi.fn().mockReturnThis();
    mockGte = vi.fn().mockReturnThis();
    mockLte = vi.fn().mockReturnThis();
    mockOr = vi.fn().mockReturnThis();

    // Final promise-resolving methods
    mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    
    mockSingle = vi.fn().mockImplementation(async () => {
      const eqCalls = mockEq.mock.calls;
      const slugCall = eqCalls.find((c: any) => c[0] === 'slug');
      if (slugCall) {
        return { data: { id: slugCall[1], slug: slugCall[1], is_active: true }, error: null };
      }
      return { data: null, error: null };
    });

    const mockMaybeSingle = vi.fn().mockImplementation(async () => {
      const eqCalls = mockEq.mock.calls;
      const slugCall = eqCalls.find((c: any) => c[0] === 'slug');
      if (slugCall) {
        return { data: { id: slugCall[1], slug: slugCall[1], is_active: true }, error: null };
      }
      return { data: null, error: null };
    });

    const queryChain = {
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      range: mockRange,
      limit: mockLimit,
      ilike: mockIlike,
      gte: mockGte,
      lte: mockLte,
      or: mockOr,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    };

    mockSupabase = {
      from: vi.fn(() => queryChain),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });

  describe('searchApprovedListings', () => {
    it('applies basic approved and active creator status checks', async () => {
      const res = await searchApprovedListings(mockSupabase as SupabaseClient, {});

      expect(res.data).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockEq).toHaveBeenCalledWith('status', 'approved');
      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
    });

    it('delegates relevance and trending sorts or text query searches to the ranked RPC', async () => {
      const res = await searchApprovedListings(mockSupabase as SupabaseClient, {
        q: 'handcrafted clay vase',
        sort: 'relevance',
      });

      expect(res.data).toEqual([]);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings_ranked', expect.objectContaining({
        p_query: 'handcrafted clay vase',
        p_sort: 'relevance',
      }));
    });

    it('applies category, types, and price bounds to standard search', async () => {
      await searchApprovedListings(mockSupabase as SupabaseClient, {
        category: CATEGORY_ID,
        listingType: 'product',
        minPrice: 100,
        maxPrice: 500,
      });

      expect(mockEq).toHaveBeenCalledWith('category_id', CATEGORY_ID);
      expect(mockEq).toHaveBeenCalledWith('listing_type', 'product');
      expect(mockGte).toHaveBeenCalledWith('price', 100);
      expect(mockLte).toHaveBeenCalledWith('price', 500);
    });

    it('applies verifiedOnly and availability flags correctly', async () => {
      await searchApprovedListings(mockSupabase as SupabaseClient, {
        verifiedOnly: true,
        customOrderAvailable: true,
        onlineAvailable: true,
      });

      expect(mockEq).toHaveBeenCalledWith('custom_order_available', true);
      expect(mockEq).toHaveBeenCalledWith('online_available', true);
    });

    it('correctly maps and flattens creator trust metrics in the search result', async () => {
      mockRange.mockResolvedValueOnce({
        data: [
          {
            id: LISTING_ID,
            title: 'Sleek Ceramic Mug',
            categories: { name: 'Pottery' },
            creator_profiles: {
              display_name: 'Jane Doe',
              slug: 'jane-doe',
              is_verified: true,
              verification_level: 'creator_verified',
              rating_avg: 4.9,
              rating_count: 15,
            },
          },
        ],
        error: null,
      });

      const res = await searchApprovedListings(mockSupabase as SupabaseClient, {});

      expect(res.data).toHaveLength(1);
      expect(res.data[0]).toEqual(
        expect.objectContaining({
          id: LISTING_ID,
          title: 'Sleek Ceramic Mug',
          category_name: 'Pottery',
          creator_display_name: 'Jane Doe',
          creator_slug: 'jane-doe',
          creator_is_verified: true,
          creator_verification_level: 'creator_verified',
          creator_rating_avg: 4.9,
          creator_rating_count: 15,
        })
      );
    });
  });

  describe('searchPublicCreators', () => {
    it('lists public creators with status active', async () => {
      await searchPublicCreators(mockSupabase as SupabaseClient, {});

      expect(mockSupabase.from).toHaveBeenCalledWith('public_profiles');
    });

    it('applies sorting params including verified_first', async () => {
      await searchPublicCreators(mockSupabase as SupabaseClient, {
        sort: 'verified_first',
      });

      expect(mockOrder).toHaveBeenCalledWith('creator_profiles(is_verified)', { ascending: false, nullsFirst: false });
    });

    it('filters creators with q parameter using OR query', async () => {
      await searchPublicCreators(mockSupabase as SupabaseClient, {
        q: 'potter',
      });

      expect(mockOr).toHaveBeenCalledWith(
        'full_name.ilike.%potter%,username.ilike.%potter%,bio.ilike.%potter%,city.ilike.%potter%,state.ilike.%potter%'
      );
    });

    it('correctly filters creators when creator_profiles is an array or a single object', async () => {
      const mockCreators = [
        {
          id: '1',
          full_name: 'Creator One',
          role: 'creator',
          creator_profiles: [
            {
              id: 'cp-1',
              is_verified: true,
              primary_category_id: 'cat-1',
            }
          ]
        },
        {
          id: '2',
          full_name: 'Creator Two',
          role: 'creator',
          creator_profiles: {
            id: 'cp-2',
            is_verified: false,
            primary_category_id: 'cat-2',
          }
        }
      ];

      mockRange.mockResolvedValueOnce({
        data: mockCreators,
        error: null,
      });

      const verifiedResult = await searchPublicCreators(mockSupabase as SupabaseClient, {
        verifiedOnly: true,
      });
      expect(verifiedResult.data).toHaveLength(1);
      expect(verifiedResult.data[0]!.id).toBe('1');

      mockRange.mockResolvedValueOnce({
        data: mockCreators,
        error: null,
      });

      const categoryResult = await searchPublicCreators(mockSupabase as SupabaseClient, {
        category: 'cat-2',
      });
      expect(categoryResult.data).toHaveLength(1);
      expect(categoryResult.data[0]!.id).toBe('2');
    });
  });

  describe('searchPublicProfiles', () => {
    it('queries public_profiles view and applies fuzzy search and range pagination', async () => {
      const { searchPublicProfiles } = await import('../search.repository');
      await searchPublicProfiles(mockSupabase as SupabaseClient, { q: 'John Doe', page: 2, limit: 10 });

      expect(mockSupabase.from).toHaveBeenCalledWith('public_profiles');
      expect(mockOr).toHaveBeenCalledWith(
        'display_name.ilike.%John Doe%,username.ilike.%John Doe%,bio.ilike.%John Doe%,city.ilike.%John Doe%,state.ilike.%John Doe%'
      );
      expect(mockRange).toHaveBeenCalledWith(10, 20);
    });
  });

  describe('search service methods mapping', () => {
    it('getExplorePageData calls listing and creator fetches in parallel', async () => {
      vi.mocked(listPublicListings).mockResolvedValueOnce([]);
      vi.mocked(listPublicCreatorProfiles).mockResolvedValueOnce([]);
      vi.mocked(listPublicProfiles).mockResolvedValueOnce([]);

      const res = await getExplorePageData(mockSupabase as SupabaseClient, {});

      expect(res.categories).toBeDefined();
      expect(res.listings).toBeDefined();
      expect(res.creators).toBeDefined();
      expect(res.people).toBeDefined();
      expect(listPublicListings).toHaveBeenCalled();
      expect(listPublicCreatorProfiles).toHaveBeenCalled();
      expect(listPublicProfiles).toHaveBeenCalled();
    });

    it('getExplorePageData applies search query parameter q when provided', async () => {
      vi.mocked(listPublicListings).mockResolvedValueOnce([]);
      vi.mocked(listPublicCreatorProfiles).mockResolvedValueOnce([]);
      vi.mocked(listPublicProfiles).mockResolvedValueOnce([]);

      const res = await getExplorePageData(mockSupabase as SupabaseClient, { q: 'paint' });

      expect(res.q).toBe('paint');
      expect(mockSupabase.from).toHaveBeenCalledWith('categories');
      expect(mockOr).toHaveBeenCalledWith(
        'display_name.ilike.%paint%,username.ilike.%paint%,bio.ilike.%paint%,city.ilike.%paint%,state.ilike.%paint%'
      );
    });

    it('getTrendingListings calls searchListingsRanked with trending parameters', async () => {
      const res = await getTrendingListings(mockSupabase as SupabaseClient, { limit: 5 });

      expect(res).toBeDefined();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings_ranked', expect.objectContaining({
        p_sort: 'trending',
      }));
    });
  });
});
