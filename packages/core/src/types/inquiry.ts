// Inquiry types for Rosovia Module 8: Inquiry System

export type InquiryType =
  | 'general'
  | 'product'
  | 'service'
  | 'mentorship'
  | 'custom_order';

export type InquiryStatus =
  | 'open'
  | 'replied'
  | 'closed'
  | 'spam';

export interface Inquiry {
  id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  inquiry_type: InquiryType;
  message: string;
  creator_response: string | null;
  status: InquiryStatus;
  replied_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Inquiry with denormalized buyer and creator display names for dashboards */
export interface InquiryWithDetails extends Inquiry {
  buyer_full_name: string | null;
  buyer_username: string | null;
  creator_display_name: string | null;
  creator_slug: string | null;
  listing_title: string | null;
}

export interface InquiryListParams {
  status?: InquiryStatus;
  page?: number;
}
