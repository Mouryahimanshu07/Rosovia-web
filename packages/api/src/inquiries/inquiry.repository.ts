import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inquiry, InquiryWithDetails, InquiryStatus, InquiryListParams } from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal helper — flatten joined row into InquiryWithDetails
// ---------------------------------------------------------------------------

type RawInquiryRow = Inquiry & {
  profiles?: { full_name: string | null; username: string | null } | null;
  creator_profiles?: { display_name: string; slug: string } | null;
  listings?: { title: string } | null;
};

function flattenInquiry(row: RawInquiryRow): InquiryWithDetails {
  return {
    ...row,
    buyer_full_name: row.profiles?.full_name ?? null,
    buyer_username: row.profiles?.username ?? null,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    creator_slug: row.creator_profiles?.slug ?? null,
    listing_title: row.listings?.title ?? null,
  };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getInquiryById(
  supabase: SupabaseClient,
  id: string
): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch inquiry: ${error.message}`);
  }
  return data as Inquiry;
}

export async function getInquiryForBuyer(
  supabase: SupabaseClient,
  inquiryId: string,
  buyerProfileId: string
): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', inquiryId)
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch inquiry: ${error.message}`);
  }
  return data as Inquiry;
}

export async function getInquiryForCreator(
  supabase: SupabaseClient,
  inquiryId: string,
  creatorProfileId: string
): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', inquiryId)
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch inquiry: ${error.message}`);
  }
  return data as Inquiry;
}

export async function listCurrentBuyerInquiries(
  supabase: SupabaseClient,
  buyerProfileId: string,
  params: InquiryListParams = {}
): Promise<InquiryWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('inquiries')
    .select('*, profiles ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title )')
    .eq('buyer_id', buyerProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list buyer inquiries: ${error.message}`);
  return (data ?? []).map((r) => flattenInquiry(r as RawInquiryRow));
}

export async function listCurrentCreatorInquiries(
  supabase: SupabaseClient,
  creatorProfileId: string,
  params: InquiryListParams = {}
): Promise<InquiryWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('inquiries')
    .select('*, profiles ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title )')
    .eq('creator_id', creatorProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creator inquiries: ${error.message}`);
  return (data ?? []).map((r) => flattenInquiry(r as RawInquiryRow));
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export async function createInquiry(
  supabase: SupabaseClient,
  data: {
    buyer_id: string;
    creator_id: string;
    listing_id?: string | null;
    inquiry_type: string;
    message: string;
  }
): Promise<Inquiry> {
  const { data: created, error } = await supabase
    .from('inquiries')
    .insert({
      ...data,
      listing_id: data.listing_id ?? null,
      status: 'open',
      creator_response: null,
      replied_at: null,
      closed_at: null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create inquiry: ${error.message}`);
  return created as Inquiry;
}

export async function updateInquiry(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    creator_response: string | null;
    status: InquiryStatus;
    replied_at: string | null;
    closed_at: string | null;
  }>
): Promise<Inquiry> {
  const { data: updated, error } = await supabase
    .from('inquiries')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update inquiry: ${error.message}`);
  return updated as Inquiry;
}
