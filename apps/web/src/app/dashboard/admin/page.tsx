import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getAdminDashboardOverview } from '@rosovia/api';
import { AdminStatCard } from '~/components/admin/admin-stat-card';

export const metadata: Metadata = {
  title: 'Admin Overview — Rosovia',
  description: 'Platform administration overview.',
};

export default async function AdminDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const stats = await getAdminDashboardOverview(supabase);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time summary of platform health and activity.</p>
      </div>

      {/* Users */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AdminStatCard label="Total Users" value={stats.total_users} icon="👥" href="/dashboard/admin/users" />
          <AdminStatCard label="Active Users" value={stats.active_users} icon="✅" variant="success" href="/dashboard/admin/users?status=active" />
          <AdminStatCard label="Suspended Users" value={stats.suspended_users} icon="🚫" variant={stats.suspended_users > 0 ? 'danger' : 'default'} href="/dashboard/admin/users?status=suspended" />
        </div>
      </section>

      {/* Creators */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Creators</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AdminStatCard label="Total Creators" value={stats.total_creators} icon="🎨" href="/dashboard/admin/creators" />
          <AdminStatCard label="Verified Creators" value={stats.verified_creators} icon="🏅" variant="success" />
          <AdminStatCard label="Pending Verification" value={stats.pending_verification_requests} icon="⏳" variant={stats.pending_verification_requests > 0 ? 'warning' : 'default'} href="/dashboard/admin/verification" />
        </div>
      </section>

      {/* Content Moderation */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Moderation</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AdminStatCard label="Pending Reports" value={stats.pending_reports} icon="🚩" variant={stats.pending_reports > 0 ? 'warning' : 'default'} href="/dashboard/admin/reports?status=pending" />
          <AdminStatCard label="Pending Listings" value={stats.pending_listings} icon="📋" variant={stats.pending_listings > 0 ? 'warning' : 'default'} href="/dashboard/admin/listings?status=pending_review" />
          <AdminStatCard label="Hidden Reviews" value={stats.hidden_reviews} icon="🙈" href="/dashboard/admin/reviews?status=hidden" />
        </div>
      </section>

      {/* Commerce */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Commerce</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AdminStatCard label="Total Orders" value={stats.total_orders} icon="📦" href="/dashboard/admin/orders" />
          <AdminStatCard label="Paid Orders" value={stats.paid_orders} icon="💰" variant="success" />
          <AdminStatCard label="Total Payments" value={stats.total_payments} icon="💳" href="/dashboard/admin/payments" />
        </div>
      </section>
    </div>
  );
}
