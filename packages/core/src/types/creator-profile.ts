export type VerificationLevel =
  | 'none'
  | 'basic_verified'
  | 'creator_verified'
  | 'seller_verified'
  | 'trusted_seller';

export interface CreatorProfile {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  story: string | null;
  primary_category_id: string | null;
  skills: string[];
  languages: string[];
  city: string | null;
  state: string | null;
  country: string;
  profile_image_url: string | null;
  intro_video_url: string | null;
  verification_level: VerificationLevel;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  total_orders: number;
  total_followers: number;
  cover_image_url: string | null;
  headline: string | null;
  website_url: string | null;
  profile_theme: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Creator profile joined with category name for list/detail views */
export interface CreatorProfileWithCategory extends CreatorProfile {
  category_name: string | null;
  category_slug: string | null;
}
