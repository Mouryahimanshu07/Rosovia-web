// Admin types for Rosovia Module 15: Admin Dashboard

import type { UserRole, UserStatus } from './user';
import type { ListingStatus, ListingType } from './listing';

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export interface AdminDashboardStats {
  // Users
  total_users: number;
  active_users: number;
  suspended_users: number;
  // Creators
  total_creators: number;
  verified_creators: number;
  // Content
  pending_verification_requests: number;
  pending_reports: number;
  pending_listings: number;
  // Commerce
  total_orders: number;
  paid_orders: number;
  total_payments: number;
  // Reviews
  hidden_reviews: number;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type AdminUserStatusAction = 'suspend' | 'reactivate';

export type AdminListingModerationAction = 'approve' | 'reject' | 'suspend' | 'archive';

export type AdminReviewModerationAction = 'hide' | 'unhide';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AdminCategoryInput {
  name: string;
  slug: string;
  description?: string;
  type: 'product' | 'service' | 'learning' | 'performance' | 'mixed';
  iconName?: string;
  priority: number;
  isActive: boolean;
}

export interface AdminListParams {
  status?: string;
  role?: UserRole;
  listingType?: ListingType;
  listingStatus?: ListingStatus;
  actionType?: string;
  targetType?: string;
  page?: number;
  q?: string;
}
