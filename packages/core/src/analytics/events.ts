// ---------------------------------------------------------------------------
// Rosovia analytics event names
// Centralized here so event names are never magic strings in component code.
// ---------------------------------------------------------------------------

export const ANALYTICS_EVENTS = {
  // Auth
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_COMPLETED: 'login_completed',

  // Creator
  CREATOR_PROFILE_CREATED: 'creator_profile_created',
  CREATOR_PROFILE_UPDATED: 'creator_profile_updated',

  // Discovery
  CATEGORY_VIEWED: 'category_viewed',
  LISTING_VIEWED: 'listing_viewed',

  // Listings
  LISTING_CREATED: 'listing_created',
  LISTING_SUBMITTED_FOR_REVIEW: 'listing_submitted_for_review',

  // Inquiries
  INQUIRY_SENT: 'inquiry_sent',

  // Custom orders
  CUSTOM_ORDER_REQUESTED: 'custom_order_requested',
  CUSTOM_ORDER_QUOTED: 'custom_order_quoted',

  // Orders & Payments
  ORDER_CREATED: 'order_created',
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_COMPLETED: 'payment_completed',

  // Reviews
  REVIEW_SUBMITTED: 'review_submitted',

  // Verification & Reports
  VERIFICATION_REQUESTED: 'verification_requested',
  REPORT_SUBMITTED: 'report_submitted',

  // Admin
  ADMIN_ACTION_PERFORMED: 'admin_action_performed',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ---------------------------------------------------------------------------
// Allowed event properties — indexed by event name.
// All values must be safe: no PII, no secrets, no private URLs.
// ---------------------------------------------------------------------------

export interface AnalyticsEventProperties {
  signup_completed: { role: string };
  login_completed: { role?: string };
  creator_profile_created: { primary_category_slug?: string };
  creator_profile_updated: { has_profile_image: boolean; primary_category_slug?: string };
  category_viewed: { category_slug: string; category_type: string };
  listing_viewed: { listing_type: string; category_slug?: string; creator_verified?: boolean };
  listing_created: { listing_type: string; category_slug?: string; custom_order_available: boolean };
  listing_submitted_for_review: { listing_type: string; category_slug?: string };
  inquiry_sent: { inquiry_type: string; has_listing: boolean };
  custom_order_requested: { has_listing: boolean; category_slug?: string; budget_provided: boolean };
  custom_order_quoted: { status: string };
  order_created: { source: 'listing' | 'custom_order'; payment_status: string; order_status: string };
  payment_started: { provider: string; order_status: string; payment_status: string };
  payment_completed: { provider: string; source: string };
  review_submitted: { rating: number; has_comment: boolean };
  verification_requested: { verification_type: string; requested_level: string; document_type?: string };
  report_submitted: { target_type: string; reason: string };
  admin_action_performed: { action_type: string; target_type: string };
}
