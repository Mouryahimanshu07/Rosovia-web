import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  followCreator,
  unfollowCreator,
  followProfile,
  unfollowProfile,
} from '../follow.service';
import { getProfileByAuthUserId } from '../../profiles/profile.repository';
import {
  getFollowRow,
  insertFollow,
  deleteFollow,
  getFollowerCount,
  getProfileFollowRow,
  insertProfileFollow,
  deleteProfileFollow,
  getProfileFollowerCount,
  getProfileFollowingCount,
} from '../follow.repository';

// Mock dependencies
vi.mock('../../profiles/profile.repository', () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock('../follow.repository', () => ({
  getFollowRow: vi.fn(),
  insertFollow: vi.fn(),
  deleteFollow: vi.fn(),
  getFollowerCount: vi.fn(),
  getProfileFollowRow: vi.fn(),
  insertProfileFollow: vi.fn(),
  deleteProfileFollow: vi.fn(),
  getProfileFollowerCount: vi.fn(),
  getProfileFollowingCount: vi.fn(),
}));

describe('Follow Service Layer', () => {
  let mockSupabase: any;
  const SENDER_AUTH_ID = 'd9796e6d-6a58-4721-a3f2-ef6cf0cfcffe';
  const SENDER_PROFILE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  const TARGET_CREATOR_PROFILE_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
  const TARGET_CREATOR_USER_PROFILE_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
  const TARGET_USER_PROFILE_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock active profile resolution by default
    vi.mocked(getProfileByAuthUserId).mockResolvedValue({
      id: SENDER_PROFILE_ID,
      role: 'buyer',
      status: 'active',
      auth_user_id: SENDER_AUTH_ID,
    } as any);

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: SENDER_AUTH_ID } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: TARGET_CREATOR_PROFILE_ID,
                user_id: TARGET_CREATOR_USER_PROFILE_ID,
              },
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: TARGET_USER_PROFILE_ID,
                status: 'active',
              },
              error: null,
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

    vi.mocked(getFollowerCount).mockResolvedValue(10);
    vi.mocked(getProfileFollowerCount).mockResolvedValue(5);
  });

  describe('followCreator', () => {
    it('succeeds and follows creator when not already following', async () => {
      vi.mocked(getFollowRow).mockResolvedValue(null);
      vi.mocked(insertFollow).mockResolvedValue({ id: 'follow-123' } as any);

      const result = await followCreator(mockSupabase as SupabaseClient, {
        creatorProfileId: TARGET_CREATOR_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: true,
        followerCount: 10,
      });
      expect(insertFollow).toHaveBeenCalledWith(mockSupabase, SENDER_PROFILE_ID, TARGET_CREATOR_PROFILE_ID);
    });

    it('returns success and does not insert if already following (idempotency)', async () => {
      vi.mocked(getFollowRow).mockResolvedValue({ id: 'follow-123' } as any);

      const result = await followCreator(mockSupabase as SupabaseClient, {
        creatorProfileId: TARGET_CREATOR_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: true,
        followerCount: 10,
      });
      expect(insertFollow).not.toHaveBeenCalled();
    });

    it('blocks self-following', async () => {
      // Set target creator user id to sender profile id to trigger self follow check
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'creator_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: TARGET_CREATOR_PROFILE_ID,
                user_id: SENDER_PROFILE_ID, // same user!
              },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      });

      await expect(
        followCreator(mockSupabase as SupabaseClient, {
          creatorProfileId: TARGET_CREATOR_PROFILE_ID,
        })
      ).rejects.toThrow('You cannot follow yourself');
    });
  });

  describe('unfollowCreator', () => {
    it('succeeds and unfollows creator when currently following', async () => {
      vi.mocked(getFollowRow).mockResolvedValue({ id: 'follow-123' } as any);
      vi.mocked(getFollowerCount).mockResolvedValue(9);

      const result = await unfollowCreator(mockSupabase as SupabaseClient, {
        creatorProfileId: TARGET_CREATOR_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: false,
        followerCount: 9,
      });
      expect(deleteFollow).toHaveBeenCalledWith(mockSupabase, SENDER_PROFILE_ID, TARGET_CREATOR_PROFILE_ID);
    });

    it('returns success and does not delete if not following (idempotency)', async () => {
      vi.mocked(getFollowRow).mockResolvedValue(null);

      const result = await unfollowCreator(mockSupabase as SupabaseClient, {
        creatorProfileId: TARGET_CREATOR_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: false,
        followerCount: 10,
      });
      expect(deleteFollow).not.toHaveBeenCalled();
    });
  });

  describe('followProfile', () => {
    it('succeeds and follows profile when not already following', async () => {
      vi.mocked(getProfileFollowRow).mockResolvedValue(null);
      vi.mocked(insertProfileFollow).mockResolvedValue({ id: 'prof-follow-123' } as any);

      const result = await followProfile(mockSupabase as SupabaseClient, {
        followingProfileId: TARGET_USER_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: true,
        followerCount: 5,
      });
      expect(insertProfileFollow).toHaveBeenCalledWith(mockSupabase, SENDER_PROFILE_ID, TARGET_USER_PROFILE_ID);
    });

    it('returns success and does not insert if already following (idempotency)', async () => {
      vi.mocked(getProfileFollowRow).mockResolvedValue({ id: 'prof-follow-123' } as any);

      const result = await followProfile(mockSupabase as SupabaseClient, {
        followingProfileId: TARGET_USER_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: true,
        followerCount: 5,
      });
      expect(insertProfileFollow).not.toHaveBeenCalled();
    });

    it('blocks self-following profile', async () => {
      await expect(
        followProfile(mockSupabase as SupabaseClient, {
          followingProfileId: SENDER_PROFILE_ID, // same user profile
        })
      ).rejects.toThrow('You cannot follow yourself');
    });
  });

  describe('unfollowProfile', () => {
    it('succeeds and unfollows profile when currently following', async () => {
      vi.mocked(getProfileFollowRow).mockResolvedValue({ id: 'prof-follow-123' } as any);
      vi.mocked(getProfileFollowerCount).mockResolvedValue(4);

      const result = await unfollowProfile(mockSupabase as SupabaseClient, {
        followingProfileId: TARGET_USER_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: false,
        followerCount: 4,
      });
      expect(deleteProfileFollow).toHaveBeenCalledWith(mockSupabase, SENDER_PROFILE_ID, TARGET_USER_PROFILE_ID);
    });

    it('returns success and does not delete if not following (idempotency)', async () => {
      vi.mocked(getProfileFollowRow).mockResolvedValue(null);

      const result = await unfollowProfile(mockSupabase as SupabaseClient, {
        followingProfileId: TARGET_USER_PROFILE_ID,
      });

      expect(result).toEqual({
        success: true,
        isFollowing: false,
        followerCount: 5,
      });
      expect(deleteProfileFollow).not.toHaveBeenCalled();
    });
  });
});
