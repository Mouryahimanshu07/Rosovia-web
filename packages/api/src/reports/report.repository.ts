import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Report,
  ReportWithDetails,
  ReportListParams,
  ReportStatus,
  ReportTargetType,
  AdminAction,
  AdminActionType,
  AdminActionTargetType,
} from '@rosovia/core';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal: flatten joined row into ReportWithDetails
// ---------------------------------------------------------------------------

type RawReportRow = Report & {
  reporter_profile?: { full_name: string | null; username: string | null } | null;
  reviewed_by_profile?: { full_name: string | null; username: string | null } | null;
};

function flattenReport(row: RawReportRow): ReportWithDetails {
  const reporterName =
    row.reporter_profile?.full_name ??
    row.reporter_profile?.username ??
    null;

  const reviewerName =
    row.reviewed_by_profile?.full_name ??
    row.reviewed_by_profile?.username ??
    null;

  return {
    ...row,
    reporter_display_name: reporterName,
    reviewed_by_name: reviewerName,
  };
}

const WITH_DETAILS_SELECT = `
  *,
  reporter_profile:profiles!reports_reporter_id_fkey ( full_name, username ),
  reviewed_by_profile:profiles!reports_reviewed_by_fkey ( full_name, username )
`.trim();

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getReportById(
  supabase: SupabaseClient,
  id: string
): Promise<ReportWithDetails | null> {
  const { data, error } = await supabase
    .from('reports')
    .select(WITH_DETAILS_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch report: ${error.message}`);
  }
  return flattenReport(data as unknown as RawReportRow);
}

export async function getDuplicatePendingReport(
  supabase: SupabaseClient,
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string
): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('reporter_id', reporterId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to check duplicate report: ${error.message}`);
  return data as Report | null;
}

export async function listCurrentUserReports(
  supabase: SupabaseClient,
  reporterProfileId: string,
  params: ReportListParams = {}
): Promise<ReportWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reports')
    .select(WITH_DETAILS_SELECT)
    .eq('reporter_id', reporterProfileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.targetType) query = query.eq('target_type', params.targetType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list user reports: ${error.message}`);
  return (data ?? []).map((r) => flattenReport(r as unknown as RawReportRow));
}

export async function listAdminReports(
  supabase: SupabaseClient,
  params: ReportListParams = {}
): Promise<ReportWithDetails[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('reports')
    .select(WITH_DETAILS_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.targetType) query = query.eq('target_type', params.targetType);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list admin reports: ${error.message}`);
  return (data ?? []).map((r) => flattenReport(r as unknown as RawReportRow));
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function createReport(
  supabase: SupabaseClient,
  data: {
    reporter_id: string;
    target_type: ReportTargetType;
    target_id: string;
    reason: string;
    description: string | null;
  }
): Promise<Report> {
  const { data: created, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: data.reporter_id,
      target_type: data.target_type,
      target_id: data.target_id,
      reason: data.reason,
      description: data.description,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create report: ${error.message}`);
  return created as Report;
}

export async function updateReport(
  supabase: SupabaseClient,
  id: string,
  data: Partial<{
    status: ReportStatus;
    admin_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
  }>
): Promise<Report> {
  const { data: updated, error } = await supabase
    .from('reports')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update report: ${error.message}`);
  return updated as Report;
}

// ---------------------------------------------------------------------------
// Target existence validation helpers
// ---------------------------------------------------------------------------

export async function validateReportTargetExists(
  supabase: SupabaseClient,
  targetType: ReportTargetType,
  targetId: string
): Promise<boolean> {
  let query;

  switch (targetType) {
    case 'creator':
      query = supabase
        .from('creator_profiles')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'listing':
      query = supabase
        .from('listings')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'review':
      query = supabase
        .from('reviews')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'inquiry':
      query = supabase
        .from('inquiries')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'user':
      query = supabase
        .from('profiles')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'post':
      query = supabase
        .from('creator_posts')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    case 'message':
      query = supabase
        .from('messages')
        .select('id')
        .eq('id', targetId)
        .is('deleted_at', null)
        .maybeSingle();
      break;

    default:
      return false;
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to validate report target: ${error.message}`);
  return data !== null;
}

/** For inquiry reports: check current user is buyer or creator for that inquiry */
export async function getInquiryParticipants(
  supabase: SupabaseClient,
  inquiryId: string
): Promise<{ buyer_id: string; creator_id: string } | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('buyer_id, creator_id')
    .eq('id', inquiryId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch inquiry participants: ${error.message}`);
  return data as { buyer_id: string; creator_id: string } | null;
}

// ---------------------------------------------------------------------------
// Admin action log
// ---------------------------------------------------------------------------

export async function createAdminAction(
  supabase: SupabaseClient,
  data: {
    admin_id: string;
    action_type: AdminActionType;
    target_type: AdminActionTargetType;
    target_id: string;
    note: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<AdminAction> {
  const { data: created, error } = await supabase
    .from('admin_actions')
    .insert({
      admin_id: data.admin_id,
      action_type: data.action_type,
      target_type: data.target_type,
      target_id: data.target_id,
      note: data.note,
      metadata: data.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create admin action: ${error.message}`);
  return created as AdminAction;
}

export async function listAdminActions(
  supabase: SupabaseClient,
  params: { page?: number } = {}
): Promise<AdminAction[]> {
  const page = params.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new Error(`Failed to list admin actions: ${error.message}`);
  return (data ?? []) as AdminAction[];
}

export async function listAdminActionsByTarget(
  supabase: SupabaseClient,
  targetType: AdminActionTargetType,
  targetId: string
): Promise<AdminAction[]> {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list admin actions by target: ${error.message}`);
  return (data ?? []) as AdminAction[];
}

export async function resolveReportAtomic(
  supabase: SupabaseClient,
  reportId: string,
  status: ReportStatus,
  resolutionNote: string | null,
  targetAction: string | null
): Promise<Report> {
  const { data, error } = await supabase.rpc('admin_resolve_report_atomic', {
    p_report_id: reportId,
    p_status: status,
    p_resolution_note: resolutionNote,
    p_target_action: targetAction,
  });

  if (error) throw new Error(`Failed to resolve report: ${error.message}`);
  return data as Report;
}
