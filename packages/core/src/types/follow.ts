// packages/core/src/types/follow.ts
// Creator Follow types for Rosovia social-commerce layer.

export interface CreatorFollow {
  id: string;
  follower_profile_id: string;
  creator_profile_id: string;
  created_at: string;
}

export interface FollowInput {
  creatorProfileId: string;
}

export interface ProfileFollow {
  id: string;
  follower_profile_id: string;
  following_profile_id: string;
  created_at: string;
}

export interface ProfileFollowInput {
  followingProfileId: string;
}
