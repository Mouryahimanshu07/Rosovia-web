import type { SupabaseClient } from '@supabase/supabase-js';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import { createAdminAction } from '../reports/report.repository';
import { getDatabaseClients } from '@rosovia/integrations';
import { getListingById } from '../listings/listing.repository';
import { createSystemNotification } from '../notifications/notification.service';
import { getPostById } from '../posts/post.repository';
import { reviewVerificationRequestAsAdmin } from '../verification/verification.service';
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
  getMarketplaceKpiSummary,
  listAdminPosts,
  setPostStatusAtomic,
  type AdminCreatorRow,
  type AdminReviewRow,
  type AdminActionWithAdmin,
} from './admin.repository';
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
  MarketplaceKpiSummary,
  AdminPostModerationSchemaInput,
  CreatorPostWithDetails,
  VerificationRequest,
} from '@rosovia/core';

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

export async function getMarketplaceKpiOverview(
  supabase: SupabaseClient
): Promise<MarketplaceKpiSummary> {
  await resolveAdmin(supabase);
  return getMarketplaceKpiSummary(supabase);
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
  const { master: serviceRoleClient } = getDatabaseClients();
  
  await setListingStatusAtomic(serviceRoleClient, input.listingId, newStatus, input.note ?? null, admin.id);

  // Fetch listing details to notify the creator
  const listing = await getListingById(serviceRoleClient, input.listingId);
  if (listing) {
    const { data: creatorProfile } = await serviceRoleClient
      .from('creator_profiles')
      .select('user_id')
      .eq('id', listing.creator_id)
      .is('deleted_at', null)
      .single();

    if (creatorProfile?.user_id) {
      const titleMap = {
        approve: 'Listing Approved',
        reject: 'Listing Rejected',
        suspend: 'Listing Suspended',
        archive: 'Listing Archived',
      };
      
      const bodyMap = {
        approve: `Your listing "${listing.title}" has been approved.`,
        reject: `Your listing "${listing.title}" has been rejected.${input.note ? ` Note: ${input.note}` : ''}`,
        suspend: `Your listing "${listing.title}" has been suspended.${input.note ? ` Reason: ${input.note}` : ''}`,
        archive: `Your listing "${listing.title}" has been archived.`,
      };

      try {
        await createSystemNotification(serviceRoleClient, {
          recipientProfileId: creatorProfile.user_id,
          type: 'admin_action',
          title: titleMap[input.action],
          body: bodyMap[input.action],
          entityType: 'listing',
          entityId: listing.id,
        });
      } catch (notifErr) {
        console.error('Failed to send creator listing notification:', notifErr);
      }
    }
  }
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

  // Log admin action for audit trail (matches pattern used in listing/post moderation)
  await createAdminAction(supabase, {
    admin_id: admin.id,
    action_type: isHidden ? 'review_hidden' : 'review_unhidden',
    target_type: 'review',
    target_id: input.reviewId,
    note: input.note ?? null,
    metadata: { is_hidden: isHidden },
  });
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

// ---------------------------------------------------------------------------
// 10. Posts Moderation
// ---------------------------------------------------------------------------

export async function listPostsForAdmin(
  supabase: SupabaseClient,
  params: AdminListParams = {}
): Promise<CreatorPostWithDetails[]> {
  await resolveAdmin(supabase);
  return listAdminPosts(supabase, params);
}

export async function moderatePostAsAdmin(
  supabase: SupabaseClient,
  input: AdminPostModerationSchemaInput
): Promise<void> {
  const admin = await resolveAdmin(supabase);
  const { master: serviceRoleClient } = getDatabaseClients();

  await setPostStatusAtomic(
    serviceRoleClient,
    input.postId,
    input.moderationStatus,
    input.note ?? null,
    admin.id
  );

  // Send creator notification
  const post = await getPostById(serviceRoleClient, input.postId);
  if (post) {
    const { data: creatorProfile } = await serviceRoleClient
      .from('creator_profiles')
      .select('user_id')
      .eq('id', post.creator_profile_id)
      .is('deleted_at', null)
      .single();

    if (creatorProfile?.user_id) {
      const type = input.moderationStatus === 'approved' ? 'post_approved' : 'post_rejected';
      const titleMap = {
        approved: 'Post Approved',
        rejected: 'Post Rejected',
        hidden: 'Post Hidden',
      };
      
      const bodyMap = {
        approved: 'Your work post has been approved and is now visible on the platform.',
        rejected: `Your work post has been rejected.${input.note ? ` Note: ${input.note}` : ''}`,
        hidden: `Your work post has been hidden by administrators.${input.note ? ` Reason: ${input.note}` : ''}`,
      };

      try {
        await createSystemNotification(serviceRoleClient, {
          recipientProfileId: creatorProfile.user_id,
          type,
          title: titleMap[input.moderationStatus],
          body: bodyMap[input.moderationStatus],
          entityType: 'post',
          entityId: post.id,
        });
      } catch (notifErr) {
        console.error('Failed to send creator post notification:', notifErr);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 11. Verification Requests
// ---------------------------------------------------------------------------

/**
 * Admin: approve or reject a creator verification request.
 * Wraps verification.service with a standard admin-only resolveAdmin() gate,
 * keeping the admin service as the single entry point for all admin actions.
 */
export async function moderateVerificationRequestAsAdmin(
  supabase: SupabaseClient,
  input: {
    requestId: string;
    action: 'approve' | 'reject';
    note?: string;
  }
): Promise<VerificationRequest> {
  await resolveAdmin(supabase);

  return reviewVerificationRequestAsAdmin(supabase, {
    verificationRequestId: input.requestId,
    decision: input.action,
    adminNote: input.note,
  });
}
