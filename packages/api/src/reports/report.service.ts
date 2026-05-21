import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Report,
  ReportWithDetails,
  ReportCreateInput,
  ReportModerationInput,
  ReportListParams,
  ReportStatus,
} from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import {
  getReportById,
  createReport,
  updateReport,
  listCurrentUserReports,
  listAdminReports,
  getDuplicatePendingReport,
  validateReportTargetExists,
  getInquiryParticipants,
  createAdminAction,
  resolveReportAtomic,
} from './report.repository';

export {
  getReportById,
  listCurrentUserReports,
  listAdminReports,
  listAdminActions,
  listAdminActionsByTarget,
} from './report.repository';

// ---------------------------------------------------------------------------
// Internal: resolve active profile from auth session
// ---------------------------------------------------------------------------

async function resolveActiveProfile(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.status !== 'active') throw new Error('Your account is not active');

  return profile;
}

// ---------------------------------------------------------------------------
// 1. Create a report (any authenticated active user)
// ---------------------------------------------------------------------------

export async function createCurrentUserReport(
  supabase: SupabaseClient,
  input: ReportCreateInput
): Promise<Report> {
  // 1. Authenticate and resolve active profile
  const profile = await resolveActiveProfile(supabase);

  // 2. Validate target exists
  const targetExists = await validateReportTargetExists(
    supabase,
    input.targetType,
    input.targetId
  );
  if (!targetExists) {
    throw new Error(`The reported ${input.targetType} does not exist or has been removed.`);
  }

  // 3. Prevent self-reports (user target type)
  if (input.targetType === 'user' && input.targetId === profile.id) {
    throw new Error('You cannot report your own account.');
  }

  // 4. For inquiry reports: current user must be the buyer or creator
  if (input.targetType === 'inquiry') {
    const participants = await getInquiryParticipants(supabase, input.targetId);
    if (!participants) {
      throw new Error('The reported inquiry does not exist or has been removed.');
    }
    const isInvolved =
      participants.buyer_id === profile.id ||
      participants.creator_id === profile.id;
    if (!isInvolved) {
      throw new Error('You can only report inquiries you are part of.');
    }
  }

  // 5. Prevent duplicate pending reports (same reporter + target)
  const existingPending = await getDuplicatePendingReport(
    supabase,
    profile.id,
    input.targetType,
    input.targetId
  );
  if (existingPending) {
    throw new Error(
      `You already have a pending report for this ${input.targetType}. Please wait for it to be reviewed.`
    );
  }

  // 6. Create the report — reporter_id comes from server, not client
  return createReport(supabase, {
    reporter_id: profile.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    description: input.description ?? null,
  });
}

// ---------------------------------------------------------------------------
// 2. List current user's own reports
// ---------------------------------------------------------------------------

export async function listCurrentUserReportsService(
  supabase: SupabaseClient,
  params: ReportListParams = {}
): Promise<ReportWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);
  return listCurrentUserReports(supabase, profile.id, params);
}

// ---------------------------------------------------------------------------
// 3. Admin: list all reports
// ---------------------------------------------------------------------------

export async function listReportsForAdmin(
  supabase: SupabaseClient,
  params: ReportListParams = {}
): Promise<ReportWithDetails[]> {
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return listAdminReports(supabase, params);
}

// ---------------------------------------------------------------------------
// 4. Admin: moderate a report
// ---------------------------------------------------------------------------

export async function moderateReportAsAdmin(
  supabase: SupabaseClient,
  input: ReportModerationInput
): Promise<Report> {
  // 1. Authenticate and verify admin
  const profile = await resolveActiveProfile(supabase);

  if (profile.role !== 'admin') {
    throw new Error('Admin access required');
  }

  // 2. Fetch the report
  const report = await getReportById(supabase, input.reportId);
  if (!report) {
    throw new Error('Report not found');
  }

  const reviewedAt = new Date().toISOString();
  const adminNote = input.adminNote ?? null;

  // 3. Validate action compatibility with target_type
  if (input.action === 'hide_review' && report.target_type !== 'review') {
    throw new Error('hide_review action is only valid for reports targeting a review.');
  }
  if (input.action === 'suspend_listing' && report.target_type !== 'listing') {
    throw new Error('suspend_listing action is only valid for reports targeting a listing.');
  }
  if (input.action === 'suspend_user' && report.target_type !== 'user') {
    throw new Error('suspend_user action is only valid for reports targeting a user.');
  }

  // 4. Determine new report status and target action
  let newStatus: ReportStatus;
  let targetAction: string | null = null;

  switch (input.action) {
    case 'mark_reviewed':
      newStatus = 'reviewed';
      break;

    case 'resolve':
      newStatus = 'resolved';
      break;

    case 'reject':
      newStatus = 'rejected';
      break;

    case 'hide_review':
      newStatus = 'resolved';
      targetAction = 'hide_review';
      break;

    case 'suspend_listing':
      newStatus = 'resolved';
      targetAction = 'suspend_listing';
      break;

    case 'suspend_user':
      newStatus = 'resolved';
      targetAction = 'suspend_user';
      break;

    default:
      throw new Error('Unknown moderation action');
  }

  // 5. Atomic resolve report (updates report, applies target action, inserts admin action)
  const updated = await resolveReportAtomic(
    supabase,
    report.id,
    newStatus,
    adminNote,
    targetAction
  );

  return updated;
}
