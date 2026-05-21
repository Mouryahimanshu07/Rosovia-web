import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Inquiry,
  InquiryWithDetails,
  InquiryListParams,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getInquiryById,
  getInquiryForBuyer,
  getInquiryForCreator,
  createInquiry,
  updateInquiry,
  listCurrentBuyerInquiries,
  listCurrentCreatorInquiries,
} from './inquiry.repository';

export {
  listCurrentBuyerInquiries,
  listCurrentCreatorInquiries,
};

// ---------------------------------------------------------------------------
// Internal: resolve the calling user's base profile and assert it is active.
// ---------------------------------------------------------------------------
async function resolveActiveProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// Buyer: create inquiry
// ---------------------------------------------------------------------------

export async function createCurrentUserInquiry(
  supabase: SupabaseClient,
  input: {
    creatorId: string;
    listingId?: string;
    inquiryType: string;
    message: string;
  }
): Promise<Inquiry> {
  const profile = await resolveActiveProfile(supabase);

  // Verify target creator exists and is not deleted
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at')
    .eq('id', input.creatorId)
    .is('deleted_at', null)
    .single();

  if (creatorError || !creatorData) {
    throw new Error('Creator not found or unavailable');
  }

  // Verify creator's base profile is active
  const { data: creatorBaseProfile, error: baseProfileError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', (creatorData as { user_id: string }).user_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (baseProfileError || !creatorBaseProfile) {
    throw new Error('This creator is not currently active');
  }

  // If listingId is provided, verify it is approved and belongs to this creator
  if (input.listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, creator_id, status, deleted_at')
      .eq('id', input.listingId)
      .is('deleted_at', null)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }
    if ((listing as { status: string }).status !== 'approved') {
      throw new Error('Inquiries can only be sent for approved listings');
    }
    if ((listing as { creator_id: string }).creator_id !== input.creatorId) {
      throw new Error('Listing does not belong to the specified creator');
    }
  }

  // Buyer cannot send inquiry to themselves (if buyer also has a creator profile)
  if ((creatorData as { user_id: string }).user_id === profile.id) {
    throw new Error('You cannot send an inquiry to yourself');
  }

  return createInquiry(supabase, {
    buyer_id: profile.id,
    creator_id: input.creatorId,
    listing_id: input.listingId ?? null,
    inquiry_type: input.inquiryType,
    message: input.message,
  });
}

// ---------------------------------------------------------------------------
// Buyer: list own inquiries
// ---------------------------------------------------------------------------

export async function listBuyerInquiriesForCurrentUser(
  supabase: SupabaseClient,
  params: InquiryListParams = {}
): Promise<InquiryWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentBuyerInquiries(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// Buyer: close own inquiry
// ---------------------------------------------------------------------------

export async function closeCurrentUserInquiry(
  supabase: SupabaseClient,
  inquiryId: string
): Promise<Inquiry> {
  const profile = await resolveActiveProfile(supabase);

  const inquiry = await getInquiryForBuyer(supabase, inquiryId, profile.id);
  if (!inquiry) throw new Error('Inquiry not found');
  if (!['open', 'replied'].includes(inquiry.status)) {
    throw new Error(`Cannot close an inquiry with status "${inquiry.status}"`);
  }

  return updateInquiry(supabase, inquiryId, {
    status: 'closed',
    closed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Creator: resolve creator profile for the current user
// ---------------------------------------------------------------------------

async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);
  if (profile.role !== 'creator') throw new Error('Only creators can manage inquiries from this dashboard');

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) throw new Error('Creator profile not found. Please complete your creator profile first.');

  return { profile, creatorProfile };
}

// ---------------------------------------------------------------------------
// Creator: list assigned inquiries
// ---------------------------------------------------------------------------

export async function listCreatorInquiriesForCurrentUser(
  supabase: SupabaseClient,
  params: InquiryListParams = {}
): Promise<InquiryWithDetails[]> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);
  return listCurrentCreatorInquiries(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Creator: reply to inquiry
// ---------------------------------------------------------------------------

export async function replyToCurrentCreatorInquiry(
  supabase: SupabaseClient,
  input: { inquiryId: string; creatorResponse: string }
): Promise<Inquiry> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const inquiry = await getInquiryForCreator(supabase, input.inquiryId, creatorProfile.id);
  if (!inquiry) throw new Error('Inquiry not found');
  if (inquiry.status === 'closed') throw new Error('Cannot reply to a closed inquiry');
  if (inquiry.status === 'spam') throw new Error('Cannot reply to a spam-marked inquiry');

  // Service-layer enforcement: creator cannot change immutable fields
  // Only creator_response, status, replied_at are updated here.
  return updateInquiry(supabase, input.inquiryId, {
    creator_response: input.creatorResponse,
    status: 'replied',
    replied_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Creator: update inquiry status (replied / closed / spam)
// ---------------------------------------------------------------------------

export async function updateCurrentCreatorInquiryStatus(
  supabase: SupabaseClient,
  input: { inquiryId: string; status: 'replied' | 'closed' | 'spam' }
): Promise<Inquiry> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const inquiry = await getInquiryForCreator(supabase, input.inquiryId, creatorProfile.id);
  if (!inquiry) throw new Error('Inquiry not found');

  const allowedStatuses = ['replied', 'closed', 'spam'] as const;
  if (!allowedStatuses.includes(input.status)) {
    throw new Error('Invalid status. Creator can set: replied, closed, or spam');
  }

  const updateData: Parameters<typeof updateInquiry>[2] = {
    status: input.status,
  };
  if (input.status === 'closed') {
    updateData.closed_at = new Date().toISOString();
  }

  return updateInquiry(supabase, input.inquiryId, updateData);
}

// ---------------------------------------------------------------------------
// Re-export raw read helpers for SSR pages
// ---------------------------------------------------------------------------
export { getInquiryById, getInquiryForBuyer, getInquiryForCreator };
