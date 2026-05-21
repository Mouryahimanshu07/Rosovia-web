import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminDashboardStats,
  AdminListParams,
  AdminUserStatusUpdateInput,
  AdminListingModerationInput,
  AdminReviewModerationInput,
  AdminCategoryCreateInput,
  AdminCategoryUpdateInput,
  AdminCategoryInput,
  DbCategory,
  ListingWithDetails,
  Profile,
  OrderWithDetails,
  Payment,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createAdminAction } from '../reports/report.repository';
import {
  getAdminDashboardStats,
  listAdminUsers,
  getProfileById,
  setUserStatusAtomic,
  listAdminCreators,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  listAdminListings,
  setListingStatusAtomic,
  listAdminReviews,
  setReviewHiddenAtomic,
  listAdminOrders,
  listAdminPayments,
  listAdminActionLogs,
  type AdminCreatorRow,
  type AdminReviewRow,
  type AdminActionWithAdmin,
} from './admin.repository';

export type {
  AdminCreatorRow,
  AdminReviewRow,
  AdminActionWithAdmin,
};

// ---------------------------------------------------------------------------
// Internal: resolve active admin profile
// ---------------------------------------------------------------------------

async function resolveAdmin(supabase: SupabaseClient): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');
  if (profile.role !== 'admin') throw new Error('Admin access required');

  return profile;
}

// ---------------------------------------------------------------------------
// 1. Dashboard stats
// ---------------------------------------------------------------------------

export async function getAdminDashboardOverview(
  supabase: SupabaseClient
): Promise<AdminDashboardStats> {
  await resolveAdmin(supabase);
  return getAdminDashboardStats(supabase);
}

// ---------------------------------------------------------------------------
// 2. Users
// ---------------------------------------------------------------------------

export async function listUsersForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<Profile[]> {
  await resolveAdmin(supabase);
  return listAdminUsers(supabase, params);
}

export async function updateUserStatusAsAdmin(
  supabase: SupabaseClient,
  input: AdminUserStatusUpdateInput
): Promise<Profile> {
  const admin = await resolveAdmin(supabase);

  // Prevent self-suspension
  if (input.userId === admin.id && input.action === 'suspend') {
    throw new Error('You cannot suspend your own admin account.');
  }

  const target = await getProfileById(supabase, input.userId);
  if (!target) throw new Error('User not found');

  const newStatus = input.action === 'suspend' ? 'suspended' : 'active';

  const updated = await setUserStatusAtomic(supabase, input.userId, newStatus, input.note ?? null);

  return updated;
}

// ---------------------------------------------------------------------------
// 3. Creators
// ---------------------------------------------------------------------------

export async function listCreatorsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminCreatorRow[]> {
  await resolveAdmin(supabase);
  return listAdminCreators(supabase, params);
}

// ---------------------------------------------------------------------------
// 4. Categories
// ---------------------------------------------------------------------------

export async function listCategoriesForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<DbCategory[]> {
  await resolveAdmin(supabase);
  return listAdminCategories(supabase, params);
}

export async function createCategoryAsAdmin(
  supabase: SupabaseClient,
  input: AdminCategoryCreateInput
): Promise<DbCategory> {
  const admin = await resolveAdmin(supabase);
  const category = await createAdminCategory(supabase, input);

  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: 'category_created',
    target_type: 'category',
    target_id: category.id,
    note: null,
    metadata: { category_name: category.name, category_slug: category.slug },
  });

  return category;
}

export async function updateCategoryAsAdmin(
  supabase: SupabaseClient,
  input: AdminCategoryUpdateInput
): Promise<DbCategory> {
  const admin = await resolveAdmin(supabase);
  const { categoryId, ...rest } = input;

  // Map camelCase to snake_case for the repository
  const repoInput: Partial<AdminCategoryInput> = {
    ...(rest.name !== undefined && { name: rest.name }),
    ...(rest.slug !== undefined && { slug: rest.slug }),
    ...(rest.description !== undefined && { description: rest.description }),
    ...(rest.type !== undefined && { type: rest.type }),
    ...(rest.iconName !== undefined && { iconName: rest.iconName }),
    ...(rest.priority !== undefined && { priority: rest.priority }),
    ...(rest.isActive !== undefined && { isActive: rest.isActive }),
  };

  const category = await updateAdminCategory(supabase, categoryId, repoInput);

  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: 'category_updated',
    target_type: 'category',
    target_id: categoryId,
    note: null,
    metadata: { updates: repoInput },
  });

  return category;
}

// ---------------------------------------------------------------------------
// 5. Listings
// ---------------------------------------------------------------------------

export async function listListingsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<ListingWithDetails[]> {
  await resolveAdmin(supabase);
  return listAdminListings(supabase, params);
}

export async function moderateListingAsAdmin(
  supabase: SupabaseClient,
  input: AdminListingModerationInput
): Promise<void> {
  const admin = await resolveAdmin(supabase);

  const statusMap = {
    approve: 'approved',
    reject: 'rejected',
    suspend: 'suspended',
    archive: 'archived',
  } as const;

  const newStatus = statusMap[input.action];
  await setListingStatusAtomic(supabase, input.listingId, newStatus, input.note ?? null);
}

// ---------------------------------------------------------------------------
// 6. Reviews
// ---------------------------------------------------------------------------

export async function listReviewsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminReviewRow[]> {
  await resolveAdmin(supabase);
  return listAdminReviews(supabase, params);
}

export async function moderateReviewAsAdmin(
  supabase: SupabaseClient,
  input: AdminReviewModerationInput
): Promise<void> {
  const admin = await resolveAdmin(supabase);

  const isHidden = input.action === 'hide';

  await setReviewHiddenAtomic(supabase, input.reviewId, isHidden, input.note ?? null);
}

// ---------------------------------------------------------------------------
// 7. Orders (read-only)
// ---------------------------------------------------------------------------

export async function listOrdersForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<OrderWithDetails[]> {
  await resolveAdmin(supabase);
  return listAdminOrders(supabase, params);
}

// ---------------------------------------------------------------------------
// 8. Payments (read-only)
// ---------------------------------------------------------------------------

export async function listPaymentsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<Omit<Payment, 'raw_payload'>[]> {
  await resolveAdmin(supabase);
  return listAdminPayments(supabase, params);
}

// ---------------------------------------------------------------------------
// 9. Audit logs (read-only)
// ---------------------------------------------------------------------------

export async function listAdminActionLogsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<AdminActionWithAdmin[]> {
  await resolveAdmin(supabase);
  return listAdminActionLogs(supabase, params);
}
