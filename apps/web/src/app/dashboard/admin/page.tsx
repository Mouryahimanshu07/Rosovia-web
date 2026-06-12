import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import { getAdminDashboardOverview, getMarketplaceKpiOverview } from '@rosovia/api';
import { AdminStatCard } from '~/components/admin/admin-stat-card';
import { MarketplaceKpiCard } from '~/components/admin/marketplace-kpi-card';

export const metadata: Metadata = {
  title: 'Admin Overview — Rosovia',
  description: 'Platform administration overview.',
};

export default async function AdminDashboardPage() {
  const profile = await getServerProfile();
  const supabase = createWebServerClient();

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const stats = await getAdminDashboardOverview(supabase);
  const kpis = await getMarketplaceKpiOverview(supabase).catch(() => ({
    gmv_30_days: 0,
    take_rate_30_days: 0,
    total_orders_completed_30_days: 0,
    aov_30_days: 0,
    repeat_purchase_rate_90_days: 0,
    inquiry_to_order_conversion_rate_pct: 0,
    refund_rate_pct: 0,
    dispute_rate_pct: 0,
  }));

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

      {/* Marketplace Operational & Financial KPIs */}
      <section className="border-t pt-8">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Marketplace Telemetry & Financial KPIs</h2>
          <p className="text-xs text-gray-400">Audited business performance metrics compiled via Supabase analytics ledger.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MarketplaceKpiCard
            label="GMV (30d)"
            value={`₹${kpis.gmv_30_days.toLocaleString('en-IN')}`}
            icon="📈"
            variant="success"
            description="Gross Merchandise Value of completed and paid bookings in the last 30 days."
          />
          <MarketplaceKpiCard
            label="Estimated Commission (30d)"
            value={`₹${kpis.take_rate_30_days.toLocaleString('en-IN')}`}
            icon="🏦"
            variant="purple"
            description="Estimated platform net commission take-rate revenue (calculated at 5% of GMV)."
          />
          <MarketplaceKpiCard
            label="Average Order Value"
            value={`₹${kpis.aov_30_days.toLocaleString('en-IN')}`}
            icon="⚖️"
            variant="default"
            description="Average transactional volume per completed order in the last 30 days."
          />
          <MarketplaceKpiCard
            label="Repeat Purchase Rate (90d)"
            value={`${kpis.repeat_purchase_rate_90_days}%`}
            icon="🔄"
            variant="purple"
            description="Ratio of buyers who purchased 2+ times in the last 90 days. Ideal benchmark >15%."
          />
          <MarketplaceKpiCard
            label="Inquiry-to-Order Conversion"
            value={`${kpis.inquiry_to_order_conversion_rate_pct}%`}
            icon="💬"
            variant="success"
            description="Percentage of buyer-to-creator inquiries converting to orders within 14 days."
          />
          <MarketplaceKpiCard
            label="Refund Rate"
            value={`${kpis.refund_rate_pct}%`}
            icon="↩️"
            variant={kpis.refund_rate_pct > 3.0 ? 'danger' : 'default'}
            description="Completed bookings culminating in a refund request. Threshold limit: 3%."
          />
          <MarketplaceKpiCard
            label="Dispute Rate"
            value={`${kpis.dispute_rate_pct}%`}
            icon="⚠️"
            variant={kpis.dispute_rate_pct > 1.0 ? 'danger' : 'warning'}
            description="Orders entering formal administrative dispute arbitration. Threshold limit: 1%."
          />
          <MarketplaceKpiCard
            label="Sales Velocity (30d)"
            value={`${kpis.total_orders_completed_30_days} sales`}
            icon="🚀"
            variant="success"
            description="Aggregate volume of successful paid conversions in the last 30 days."
          />
        </div>
      </section>
    </div>
  );
}
