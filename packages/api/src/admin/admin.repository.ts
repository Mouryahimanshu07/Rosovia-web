import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Profile,
  DbCategory,
  Listing,
  ListingWithDetails,
  ListingStatus,
  Order,
  OrderWithDetails,
  Payment,
  AdminDashboardStats,
  AdminListParams,
  AdminCategoryInput,
  MarketplaceKpiSummary,
  CreatorPost,
  CreatorPostWithDetails,
} from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getAdminDashboardStats(
  supabase: SupabaseClient
): Promise<AdminDashboardStats> {
  const [
    { count: total_users },
    { count: active_users },
    { count: suspended_users },
    { count: total_creators },
    { count: verified_creators },
    { count: pending_verification_requests },
    { count: pending_reports },
    { count: pending_listings },
    { count: total_orders },
    { count: paid_orders },
    { count: total_payments },
    { count: hidden_reviews },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended').is('deleted_at', null),
    supabase.from('creator_profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('creator_profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true).is('deleted_at', null),
    supabase.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending_review').is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid').is('deleted_at', null),
    supabase.from('payments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('is_hidden', true).is('deleted_at', null),
  ]);

  return {
    total_users: total_users ?? 0,
    active_users: active_users ?? 0,
    suspended_users: suspended_users ?? 0,
    total_creators: total_creators ?? 0,
    verified_creators: verified_creators ?? 0,
    pending_verification_requests: pending_verification_requests ?? 0,
    pending_reports: pending_reports ?? 0,
    pending_listings: pending_listings ?? 0,
    total_orders: total_orders ?? 0,
    paid_orders: paid_orders ?? 0,
    total_payments: total_payments ?? 0,
    hidden_reviews: hidden_reviews ?? 0,
  };
}

export async function getMarketplaceKpiSummary(
  supabase: SupabaseClient
): Promise<MarketplaceKpiSummary> {
  const { data, error } = await supabase.rpc('get_marketplace_kpi_summary_atomic');
  if (error) throw new Error(`Failed to fetch marketplace KPIs: ${error.message}`);

  const row = data?.[0] || {
    gmv_30_days: 0,
    take_rate_30_days: 0,
    total_orders_completed_30_days: 0,
    aov_30_days: 0,
    repeat_purchase_rate_90_days: 0,
    inquiry_to_order_conversion_rate_pct: 0,
    refund_rate_pct: 0,
    dispute_rate_pct: 0,
  };

  return {
    gmv_30_days: Number(row.gmv_30_days || 0),
    take_rate_30_days: Number(row.take_rate_30_days || 0),
    total_orders_completed_30_days: Number(row.total_orders_completed_30_days || 0),
    aov_30_days: Number(row.aov_30_days || 0),
    repeat_purchase_rate_90_days: Number(row.repeat_purchase_rate_90_days || 0),
    inquiry_to_order_conversion_rate_pct: Number(row.inquiry_to_order_conversion_rate_pct || 0),
    refund_rate_pct: Number(row.refund_rate_pct || 0),
    dispute_rate_pct: Number(row.dispute_rate_pct || 0),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listAdminUsers(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<Profile[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.role) query = query.eq('role', params.role);
  if (params.q) query = query.ilike('full_name', `%${params.q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  return (data ?? []) as Profile[];
}

export async function getProfileById(
  supabase: SupabaseClient,
  profileId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
  return data as Profile | null;
}

export async function setUserStatusAtomic(
  supabase: SupabaseClient,
  profileId: string,
  status: 'active' | 'suspended',
  note: string | null = null
): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_set_user_status_atomic', {
    p_user_id: profileId,
    p_status: status,
    p_note: note,
  });

  if (error) throw new Error(`Failed to update user status: ${error.message}`);
  return data as Profile;
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

type RawCreatorRow = {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  verification_level: string;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles?: { full_name: string | null; email: string | null; status: string } | null;
  categories?: { name: string } | null;
};

export interface AdminCreatorRow {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  verification_level: string;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  city: string | null;
  state: string | null;
  created_at: string;
  linked_user_name: string | null;
  linked_user_email: string | null;
  linked_user_status: string | null;
}

function flattenCreator(row: RawCreatorRow): AdminCreatorRow {
  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    slug: row.slug,
    verification_level: row.verification_level,
    is_verified: row.is_verified,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    city: row.city,
    state: row.state,
    created_at: row.created_at,
    linked_user_name: row.profiles?.full_name ?? null,
    linked_user_email: row.profiles?.email ?? null,
    linked_user_status: row.profiles?.status ?? null,
  };
}

export async function listAdminCreators(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminCreatorRow[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_profiles')
    .select('*, profiles ( full_name, email, status )')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.q) query = query.ilike('display_name', `%${params.q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list creators: ${error.message}`);
  return (data ?? []).map((r) => flattenCreator(r as unknown as RawCreatorRow));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listAdminCategories(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<DbCategory[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('categories')
    .select('*')
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status === 'active') query = query.eq('is_active', true);
  if (params.status === 'inactive') query = query.eq('is_active', false);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list categories: ${error.message}`);
  return (data ?? []) as DbCategory[];
}

export async function createAdminCategory(
  supabase: SupabaseClient,
  input: AdminCategoryInput
): Promise<DbCategory> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      type: input.type,
      icon_name: input.iconName ?? null,
      priority: input.priority,
      is_active: input.isActive,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create category: ${error.message}`);
  return data as DbCategory;
}

export async function updateAdminCategory(
  supabase: SupabaseClient,
  categoryId: string,
  input: Partial<AdminCategoryInput>
): Promise<DbCategory> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.iconName !== undefined) updateData.icon_name = input.iconName;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', categoryId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update category: ${error.message}`);
  return data as DbCategory;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export async function listAdminListings(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<ListingWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('listings')
    .select('*, categories ( name ), creator_profiles ( display_name, slug )')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.listingStatus) query = query.eq('status', params.listingStatus);
  if (params.listingType) query = query.eq('listing_type', params.listingType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin listings: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as Listing & {
      categories?: { name: string } | null;
      creator_profiles?: { display_name: string; slug: string } | null;
    };
    return {
      ...r,
      category_name: r.categories?.name ?? null,
      creator_display_name: r.creator_profiles?.display_name ?? null,
      creator_slug: r.creator_profiles?.slug ?? null,
    };
  });
}

export async function setListingStatusAtomic(
  supabase: SupabaseClient,
  listingId: string,
  status: ListingStatus,
  note: string | null = null,
  adminId: string | null = null
): Promise<Listing> {
  const { data, error } = await supabase.rpc('admin_moderate_listing_atomic', {
    p_listing_id: listingId,
    p_status: status,
    p_note: note,
    p_admin_id: adminId,
  });

  if (error) throw new Error(`Failed to update listing status: ${error.message}`);
  return data as Listing;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

type RawAdminReviewRow = {
  id: string;
  order_id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  rating: number;
  quality_rating: number | null;
  communication_rating: number | null;
  delivery_rating: number | null;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles?: { full_name: string | null; username: string | null } | null;
  creator_profiles?: { display_name: string; slug: string } | null;
  listings?: { title: string } | null;
};

export interface AdminReviewRow {
  id: string;
  order_id: string;
  buyer_id: string;
  creator_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
  buyer_display_name: string | null;
  creator_display_name: string | null;
  listing_title: string | null;
}

function flattenAdminReview(row: RawAdminReviewRow): AdminReviewRow {
  return {
    id: row.id,
    order_id: row.order_id,
    buyer_id: row.buyer_id,
    creator_id: row.creator_id,
    listing_id: row.listing_id,
    rating: row.rating,
    comment: row.comment,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    buyer_display_name: row.profiles?.full_name ?? row.profiles?.username ?? null,
    creator_display_name: row.creator_profiles?.display_name ?? null,
    listing_title: row.listings?.title ?? null,
  };
}

export async function listAdminReviews(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminReviewRow[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reviews')
    .select('*, profiles!reviews_buyer_id_fkey ( full_name, username ), creator_profiles ( display_name, slug ), listings ( title )')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status === 'hidden') query = query.eq('is_hidden', true);
  if (params.status === 'visible') query = query.eq('is_hidden', false);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin reviews: ${error.message}`);
  return (data ?? []).map((r) => flattenAdminReview(r as unknown as RawAdminReviewRow));
}

export async function setReviewHiddenAtomic(
  supabase: SupabaseClient,
  reviewId: string,
  isHidden: boolean,
  note: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc('admin_moderate_review_atomic', {
    p_review_id: reviewId,
    p_is_hidden: isHidden,
    p_note: note,
  });

  if (error) throw new Error(`Failed to update review visibility: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Orders (read-only)
// ---------------------------------------------------------------------------

export async function listAdminOrders(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<OrderWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('orders')
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey ( full_name, username ),
      creator:creator_profiles!orders_creator_id_fkey ( display_name, slug ),
      listings ( title ),
      custom_orders ( title )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('order_status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin orders: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as Order & {
      buyer?: { full_name: string | null; username: string | null } | null;
      creator?: { display_name: string; slug: string } | null;
      listings?: { title: string } | null;
      custom_orders?: { title: string } | null;
    };
    return {
      ...r,
      buyer_full_name: r.buyer?.full_name ?? null,
      buyer_username: r.buyer?.username ?? null,
      creator_display_name: r.creator?.display_name ?? null,
      creator_slug: r.creator?.slug ?? null,
      listing_title: r.listings?.title ?? null,
      custom_order_title: r.custom_orders?.title ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Payments (read-only)
// ---------------------------------------------------------------------------

export async function listAdminPayments(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<Omit<Payment, 'raw_payload'>[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Intentionally omit raw_payload for security — do not expose by default
  let query = supabase
    .from('payments')
    .select('id, order_id, provider, provider_payment_id, provider_order_id, provider_payment_link_id, amount, currency, status, webhook_received, webhook_event_id, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin payments: ${error.message}`);
  return (data ?? []) as Omit<Payment, 'raw_payload'>[];
}

// ---------------------------------------------------------------------------
// Audit logs — re-exported convenience wrapper with richer filtering
// ---------------------------------------------------------------------------

export interface AdminActionWithAdmin {
  id: string;
  admin_id: string | null;
  action_type: string;
  target_type: string;
  target_id: string;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  admin_name: string | null;
}

export async function listAdminActionLogs(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminActionWithAdmin[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('admin_actions')
    .select('*, admin:profiles!admin_actions_admin_id_fkey ( full_name, username )')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.actionType) query = query.eq('action_type', params.actionType);
  if (params.targetType) query = query.eq('target_type', params.targetType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin actions: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      admin_id: string | null;
      action_type: string;
      target_type: string;
      target_id: string;
      note: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
      admin?: { full_name: string | null; username: string | null } | null;
    };
    return {
      id: r.id,
      admin_id: r.admin_id,
      action_type: r.action_type,
      target_type: r.target_type,
      target_id: r.target_id,
      note: r.note,
      metadata: r.metadata,
      created_at: r.created_at,
      admin_name: r.admin?.full_name ?? r.admin?.username ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Posts Moderation
// ---------------------------------------------------------------------------

export async function listAdminPosts(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<CreatorPostWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('creator_posts')
    .select(`
      *,
      creator_profiles!inner (
        id,
        display_name,
        slug,
        profile_image_url,
        is_verified,
        verification_level,
        user_id,
        profiles!inner ( username, full_name )
      ),
      creator_post_media (
        id,
        post_id,
        media_asset_id,
        sort_order,
        media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) {
    query = query.eq('moderation_status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin posts: ${error.message}`);

  return (data ?? []).map((row: any) => {
    const cp = row.creator_profiles;
    const media = (row.creator_post_media ?? []).map((m: any) => ({
      id: m.id,
      post_id: m.post_id,
      media_asset_id: m.media_asset_id,
      sort_order: m.sort_order,
      created_at: m.created_at,
      public_url: m.media_assets?.public_url ?? null,
      mime_type: m.media_assets?.mime_type ?? '',
      media_type: m.media_assets?.media_type ?? 'image',
      thumbnail_url: m.media_assets?.thumbnail_url ?? null,
    }));

    media.sort((a: any, b: any) => a.sort_order - b.sort_order);

    return {
      id: row.id,
      creator_profile_id: row.creator_profile_id,
      caption: row.caption,
      post_type: row.post_type,
      listing_id: row.listing_id,
      visibility: row.visibility,
      moderation_status: row.moderation_status,
      like_count: row.like_count,
      save_count: row.save_count,
      view_count: row.view_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      creator_display_name: cp?.display_name ?? null,
      creator_slug: cp?.slug ?? null,
      creator_username: cp?.profiles?.username ?? null,
      creator_full_name: cp?.profiles?.full_name ?? null,
      creator_profile_image_url: cp?.profile_image_url ?? null,
      creator_is_verified: cp?.is_verified ?? false,
      creator_verification_level: cp?.verification_level ?? 'none',
      category_name: null,
      media,
    } as any;
  });
}

export async function setPostStatusAtomic(
  supabase: SupabaseClient,
  postId: string,
  status: 'pending' | 'approved' | 'rejected' | 'hidden',
  note: string | null = null,
  adminId: string | null = null
): Promise<CreatorPost> {
  const { data, error } = await supabase.rpc('admin_moderate_post_atomic', {
    p_post_id: postId,
    p_status: status,
    p_note: note,
    p_admin_id: adminId,
  });

  if (error) throw new Error(`Failed to update post status: ${error.message}`);
  return data as CreatorPost;
}
