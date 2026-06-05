import type { VerificationLevel } from './creator-profile';

export type ListingType =
  | 'product'
  | 'service'
  | 'mentorship'
  | 'workshop'
  | 'event_booking'
  | 'portfolio';

export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'suspended';

export type ListingVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';

export interface ListingMetadata {
  deliveryDays?: number;
  material?: string;
  techStack?: string;
  revisionCount?: number;
  fileFormats?: string;
  [key: string]: unknown;
}

export interface Listing {
  id: string;
  creator_id: string;
  category_id: string;
  listing_type: ListingType;
  title: string;
  slug: string;
  description: string | null;
  price: number | null;
  currency: string;
  stock: number | null;
  city: string | null;
  state: string | null;
  custom_order_available: boolean;
  delivery_available: boolean;
  online_available: boolean;
  offline_available: boolean;
  status: ListingStatus;
  verification_status: ListingVerificationStatus;
  metadata: ListingMetadata;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reserved_stock: number;
  sold_stock: number;
}

/** Listing joined with category and creator profile details */
export interface ListingWithDetails extends Listing {
  category_name: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  creator_is_verified?: boolean | null;
  creator_verification_level?: VerificationLevel | null;
  creator_rating_avg?: number | null;
  creator_rating_count?: number | null;
  moderation_note?: string | null;
}

