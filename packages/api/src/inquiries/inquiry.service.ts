import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inquiryCreateSchema,
  inquiryReplySchema,
  inquiryStatusUpdateSchema,
  type Inquiry,
  type InquiryWithDetails,
  type InquiryListParams,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import { createSystemNotification } from '../notifications/notification.service';
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
  // Rigorous service-layer input validation
  const validatedInput = inquiryCreateSchema.parse(input);

  const profile = await resolveActiveProfile(supabase);

  // Verify target creator exists and is not deleted
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at')
    .eq('id', validatedInput.creatorId)
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
  if (validatedInput.listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, creator_id, status, deleted_at')
      .eq('id', validatedInput.listingId)
      .is('deleted_at', null)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }
    if ((listing as { status: string }).status !== 'approved') {
      throw new Error('Inquiries can only be sent for approved listings');
    }
    if ((listing as { creator_id: string }).creator_id !== validatedInput.creatorId) {
      throw new Error('Listing does not belong to the specified creator');
    }
  }

  // Buyer cannot send inquiry to themselves (if buyer also has a creator profile)
  if ((creatorData as { user_id: string }).user_id === profile.id) {
    throw new Error('You cannot send an inquiry to yourself');
  }

  const inquiry = await createInquiry(supabase, {
    buyer_id: profile.id,
    creator_id: validatedInput.creatorId,
    listing_id: validatedInput.listingId ?? null,
    inquiry_type: validatedInput.inquiryType,
    message: validatedInput.message,
  });

  try {
    await createSystemNotification(supabase, {
      recipientProfileId: (creatorData as { user_id: string }).user_id,
      type: 'inquiry_received',
      title: 'New Inquiry Received',
      body: `New inquiry of type "${validatedInput.inquiryType}" received from buyer.`,
      entityType: 'inquiry',
      entityId: inquiry.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for inquiry creation:', notificationError);
  }

  return inquiry;
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
  const { z } = await import('zod');
  const validatedId = z.string().uuid('Inquiry ID must be a valid UUID').parse(inquiryId);

  const profile = await resolveActiveProfile(supabase);

  const inquiry = await getInquiryForBuyer(supabase, validatedId, profile.id);
  if (!inquiry) throw new Error('Inquiry not found');
  if (!['open', 'replied'].includes(inquiry.status)) {
    throw new Error(`Cannot close an inquiry with status "${inquiry.status}"`);
  }

  return updateInquiry(supabase, validatedId, {
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
  const validatedInput = inquiryReplySchema.parse(input);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const inquiry = await getInquiryForCreator(supabase, validatedInput.inquiryId, creatorProfile.id);
  if (!inquiry) throw new Error('Inquiry not found');
  if (inquiry.status === 'closed') throw new Error('Cannot reply to a closed inquiry');
  if (inquiry.status === 'spam') throw new Error('Cannot reply to a spam-marked inquiry');

  const updatedInquiry = await updateInquiry(supabase, validatedInput.inquiryId, {
    creator_response: validatedInput.creatorResponse,
    status: 'replied',
    replied_at: new Date().toISOString(),
  });

  try {
    await createSystemNotification(supabase, {
      recipientProfileId: inquiry.buyer_id,
      type: 'inquiry_replied',
      title: 'Inquiry Replied',
      body: 'The creator has replied to your inquiry.',
      entityType: 'inquiry',
      entityId: inquiry.id,
    });
  } catch (notificationError) {
    console.error('Failed to send notification for inquiry reply:', notificationError);
  }

  return updatedInquiry;
}

// ---------------------------------------------------------------------------
// Creator: update inquiry status (replied / closed / spam)
// ---------------------------------------------------------------------------

export async function updateCurrentCreatorInquiryStatus(
  supabase: SupabaseClient,
  input: { inquiryId: string; status: 'replied' | 'closed' | 'spam' }
): Promise<Inquiry> {
  const validatedInput = inquiryStatusUpdateSchema.parse(input);

  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const inquiry = await getInquiryForCreator(supabase, validatedInput.inquiryId, creatorProfile.id);
  if (!inquiry) throw new Error('Inquiry not found');

  const allowedStatuses = ['replied', 'closed', 'spam'] as const;
  if (!(allowedStatuses as readonly string[]).includes(validatedInput.status)) {
    throw new Error('Invalid status. Creator can set: replied, closed, or spam');
  }

  const updateData: Parameters<typeof updateInquiry>[2] = {
    status: validatedInput.status,
  };
  if (validatedInput.status === 'closed') {
    updateData.closed_at = new Date().toISOString();
  }

  return updateInquiry(supabase, validatedInput.inquiryId, updateData);
}

// ---------------------------------------------------------------------------
// Re-export raw read helpers for SSR pages
// ---------------------------------------------------------------------------
export { getInquiryById, getInquiryForBuyer, getInquiryForCreator };
