import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CustomOrder,
  CustomOrderWithDetails,
  CustomOrderListParams,
  CustomOrderCreateInput,
  CreatorQuoteCustomOrderInput,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { getCreatorProfileByUserId } from '../creator-profiles/creator-profile.repository';
import {
  getCustomOrderForBuyer,
  getCustomOrderForCreator,
  createCustomOrder,
  updateCustomOrder,
  listCurrentBuyerCustomOrders,
  listCurrentCreatorCustomOrders,
} from './custom-order.repository';

export {
  listCurrentBuyerCustomOrders,
  listCurrentCreatorCustomOrders,
};

// ---------------------------------------------------------------------------
// Internal: resolve active base profile from auth session
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
// Internal: resolve active creator profile for the calling user
// ---------------------------------------------------------------------------

async function resolveActiveCreatorProfile(supabase: SupabaseClient) {
  const profile = await resolveActiveProfile(supabase);
  if (profile.role !== 'creator') {
    throw new Error('Only creators can manage custom orders from the creator dashboard');
  }

  const creatorProfile = await getCreatorProfileByUserId(supabase, profile.id);
  if (!creatorProfile) {
    throw new Error('Creator profile not found. Please complete your creator profile first.');
  }

  return { profile, creatorProfile };
}

// ---------------------------------------------------------------------------
// Buyer: create a new custom order
// ---------------------------------------------------------------------------

export async function createCurrentUserCustomOrder(
  supabase: SupabaseClient,
  input: CustomOrderCreateInput
): Promise<CustomOrder> {
  const profile = await resolveActiveProfile(supabase);

  // Verify target creator exists and is active
  const { data: creatorData, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('id, user_id, deleted_at')
    .eq('id', input.creatorId)
    .is('deleted_at', null)
    .single();

  if (creatorError || !creatorData) {
    throw new Error('Creator not found or unavailable');
  }

  const creatorRecord = creatorData as { id: string; user_id: string };

  // Verify creator's base profile is active
  const { data: creatorBaseProfile, error: baseProfileError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', creatorRecord.user_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (baseProfileError || !creatorBaseProfile) {
    throw new Error('This creator is not currently accepting orders');
  }

  // Buyer cannot send order to themselves
  if (creatorRecord.user_id === profile.id) {
    throw new Error('You cannot send a custom order to yourself');
  }

  // Verify category exists and is active
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('id', input.categoryId)
    .single();

  if (categoryError || !category) {
    throw new Error('Category not found');
  }
  if (!(category as { is_active: boolean }).is_active) {
    throw new Error('This category is no longer active');
  }

  // Validate listing if provided
  let resolvedCategoryId = input.categoryId;
  if (input.listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, creator_id, status, deleted_at, category_id')
      .eq('id', input.listingId)
      .is('deleted_at', null)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }
    const listingRow = listing as { creator_id: string; status: string; category_id: string | null };
    if (listingRow.status !== 'approved') {
      throw new Error('Custom orders can only be sent for approved listings');
    }
    if (listingRow.creator_id !== input.creatorId) {
      throw new Error('Listing does not belong to the specified creator');
    }
    // Use listing's category if provided category was not explicit
    if (listingRow.category_id) {
      resolvedCategoryId = listingRow.category_id;
    }
  }

  // Validate reference media if provided: must belong to the buyer
  if (input.referenceMediaId) {
    const { data: media, error: mediaError } = await supabase
      .from('media_assets')
      .select('id, owner_id')
      .eq('id', input.referenceMediaId)
      .single();

    if (mediaError || !media) {
      throw new Error('Reference media not found');
    }
    if ((media as { owner_id: string }).owner_id !== profile.id) {
      throw new Error('Reference media does not belong to you');
    }
  }

  return createCustomOrder(supabase, {
    buyer_id: profile.id,
    creator_id: input.creatorId,
    listing_id: input.listingId ?? null,
    category_id: resolvedCategoryId,
    title: input.title,
    description: input.description,
    reference_media_id: input.referenceMediaId ?? null,
    budget_min: input.budgetMin ?? null,
    budget_max: input.budgetMax ?? null,
    deadline: input.deadline ?? null,
    delivery_city: input.deliveryCity ?? null,
    delivery_state: input.deliveryState ?? null,
  });
}

// ---------------------------------------------------------------------------
// Buyer: list own custom orders
// ---------------------------------------------------------------------------

export async function listBuyerCustomOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentBuyerCustomOrders(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// Buyer: accept quote (quoted → accepted)
// ---------------------------------------------------------------------------

export async function acceptCurrentBuyerCustomOrderQuote(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const profile = await resolveActiveProfile(supabase);

  const order = await getCustomOrderForBuyer(supabase, customOrderId, profile.id);
  if (!order) throw new Error('Custom order not found');
  if (order.status !== 'quoted') {
    throw new Error('You can only accept a quote when the order status is "quoted"');
  }
  if (order.creator_quote_amount === null) {
    throw new Error('Creator has not provided a quote amount yet');
  }

  return updateCustomOrder(supabase, customOrderId, { status: 'accepted' });
}

// ---------------------------------------------------------------------------
// Buyer: cancel own custom order
// ---------------------------------------------------------------------------

export async function cancelCurrentBuyerCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const profile = await resolveActiveProfile(supabase);

  const order = await getCustomOrderForBuyer(supabase, customOrderId, profile.id);
  if (!order) throw new Error('Custom order not found');

  const cancellableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel a custom order with status "${order.status}"`);
  }

  return updateCustomOrder(supabase, customOrderId, { status: 'cancelled' });
}

// ---------------------------------------------------------------------------
// Creator: list assigned custom orders
// ---------------------------------------------------------------------------

export async function listCreatorCustomOrdersForCurrentUser(
  supabase: SupabaseClient,
  params: CustomOrderListParams = {}
): Promise<CustomOrderWithDetails[]> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);
  return listCurrentCreatorCustomOrders(supabase, creatorProfile.id, params);
}

// ---------------------------------------------------------------------------
// Creator: mark as reviewing (requested → creator_reviewing)
// ---------------------------------------------------------------------------

export async function markCurrentCreatorCustomOrderReviewing(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, customOrderId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');
  if (order.status !== 'requested') {
    throw new Error('Can only mark an order as reviewing when it is in "requested" status');
  }

  return updateCustomOrder(supabase, customOrderId, { status: 'creator_reviewing' });
}

// ---------------------------------------------------------------------------
// Creator: submit quote (requested/creator_reviewing → quoted)
// ---------------------------------------------------------------------------

export async function quoteCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  input: CreatorQuoteCustomOrderInput
): Promise<CustomOrder> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, input.customOrderId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const quotableStatuses: string[] = ['requested', 'creator_reviewing'];
  if (!quotableStatuses.includes(order.status)) {
    throw new Error(`Cannot quote a custom order with status "${order.status}"`);
  }

  return updateCustomOrder(supabase, input.customOrderId, {
    status: 'quoted',
    creator_quote_amount: input.creatorQuoteAmount,
    creator_quote_note: input.creatorQuoteNote ?? null,
  });
}

// ---------------------------------------------------------------------------
// Creator: reject custom order (requested/creator_reviewing/quoted → rejected)
// ---------------------------------------------------------------------------

export async function rejectCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, customOrderId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const rejectableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!rejectableStatuses.includes(order.status)) {
    throw new Error(`Cannot reject a custom order with status "${order.status}"`);
  }

  return updateCustomOrder(supabase, customOrderId, { status: 'rejected' });
}

// ---------------------------------------------------------------------------
// Creator: cancel custom order (before payment/order stage)
// ---------------------------------------------------------------------------

export async function cancelCurrentCreatorCustomOrder(
  supabase: SupabaseClient,
  customOrderId: string
): Promise<CustomOrder> {
  const { creatorProfile } = await resolveActiveCreatorProfile(supabase);

  const order = await getCustomOrderForCreator(supabase, customOrderId, creatorProfile.id);
  if (!order) throw new Error('Custom order not found');

  const cancellableStatuses: string[] = ['requested', 'creator_reviewing', 'quoted'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel a custom order with status "${order.status}"`);
  }

  return updateCustomOrder(supabase, customOrderId, { status: 'cancelled' });
}

// Re-export raw read helpers for SSR pages
export { getCustomOrderForBuyer, getCustomOrderForCreator };
