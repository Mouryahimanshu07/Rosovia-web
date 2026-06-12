import Link from 'next/link';
import { redirect } from 'next/navigation';
import { 
  ShoppingBag, 
  Tag, 
  MessageSquare, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Star,
  Users,
  Eye,
  Heart,
  Clock,
  Plus,
  User,
  ShieldCheck,
  HeartHandshake,
  ChevronRight
} from 'lucide-react';
import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import { getUnreadMessageCountForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getActiveOrderStatusBadge(status: string): { bg: string; text: string; border: string; label: string } {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    accepted: { bg: 'bg-blue-50/70', text: 'text-blue-750', border: 'border-blue-200', label: 'Accepted' },
    in_progress: { bg: 'bg-indigo-50/70', text: 'text-indigo-750', border: 'border-indigo-200', label: 'In Progress' },
    shipped: { bg: 'bg-purple-50/70', text: 'text-purple-750', border: 'border-purple-200', label: 'Shipped' },
    delivered: { bg: 'bg-emerald-50/70', text: 'text-emerald-750', border: 'border-emerald-200', label: 'Delivered' },
  };
  return map[status] ?? { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: status };
}

export default async function CreatorDashboardPage() {
  const profile = await getServerProfile();
  const supabase = createWebServerClient();

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  // Fetch creator profile
  const { data: creatorProfile } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', profile.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!creatorProfile) {
    redirect('/dashboard/profile?onboard=creator');
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch metrics in parallel
  const [
    listingsRes,
    activeListingsRes,
    postsRes,
    totalInquiriesRes,
    repliedOrClosedInquiriesRes,
    pendingInquiriesRes,
    completedOrdersRes,
    activeOrdersRes,
    totalFollowsRes,
    recentFollowsRes,
    followingRes,
    savedCreatorsRes,
    unreadMessagesCount
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).eq('status', 'approved').is('deleted_at', null),
    supabase.from('creator_posts').select('*', { count: 'exact', head: true }).eq('creator_profile_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).in('status', ['replied', 'closed']).is('deleted_at', null),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).eq('status', 'open').is('deleted_at', null),
    supabase.from('orders').select('seller_amount, currency').eq('creator_id', creatorProfile.id).eq('order_status', 'completed').is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).in('order_status', ['accepted', 'in_progress', 'shipped', 'delivered']).is('deleted_at', null),
    supabase.from('profile_follows').select('*', { count: 'exact', head: true }).eq('following_profile_id', profile.id),
    supabase.from('profile_follows').select('*', { count: 'exact', head: true }).eq('following_profile_id', profile.id).gte('created_at', thirtyDaysAgo.toISOString()),
    supabase.from('profile_follows').select('*', { count: 'exact', head: true }).eq('follower_profile_id', profile.id),
    supabase.from('saved_creators').select('*', { count: 'exact', head: true }).eq('creator_profile_id', creatorProfile.id),
    getUnreadMessageCountForCurrentUser(supabase).catch(() => 0)
  ]);

  const totalListings = listingsRes.count ?? 0;
  const activeListings = activeListingsRes.count ?? 0;
  const totalPosts = postsRes.count ?? 0;
  const totalInquiries = totalInquiriesRes.count ?? 0;
  const repliedOrClosedInquiries = repliedOrClosedInquiriesRes.count ?? 0;
  const pendingInquiriesCount = pendingInquiriesRes.count ?? 0;
  const completedOrdersCount = completedOrdersRes.data?.length ?? 0;
  const activeOrdersCount = activeOrdersRes.count ?? 0;
  const followingCount = followingRes.count ?? 0;

  // Total Earnings calculation
  const completedOrders = completedOrdersRes.data ?? [];
  const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.seller_amount || 0), 0);
  const currency = completedOrders[0]?.currency || 'INR';

  // Response Rate
  const responseRate = totalInquiries > 0 ? Math.round((repliedOrClosedInquiries / totalInquiries) * 100) : 100;

  // Follower Growth calculation
  const followersCount = creatorProfile.total_followers || totalFollowsRes.count || 0;
  const recentFollowersCount = recentFollowsRes.count ?? 0;
  const followerGrowthRate = followersCount > 0 ? Math.round((recentFollowersCount / followersCount) * 100) : 0;

  // Fetch saved listings count (listings bookmarked by other users)
  const { data: creatorListings } = await supabase
    .from('listings')
    .select('id')
    .eq('creator_id', creatorProfile.id)
    .is('deleted_at', null);

  const listingIds = creatorListings?.map((l) => l.id) ?? [];
  let savedListingsCount = 0;
  if (listingIds.length > 0) {
    const { count } = await supabase
      .from('saved_listings')
      .select('*', { count: 'exact', head: true })
      .in('listing_id', listingIds);
    savedListingsCount = count ?? 0;
  }
  const totalSavesCount = savedListingsCount + (savedCreatorsRes.count ?? 0);

  // Fetch recent active orders (up to 3)
  const { data: recentActiveOrdersData } = await supabase
    .from('orders')
    .select('*, profiles(full_name, username, avatar_url), listings(title), custom_orders(title, deadline)')
    .eq('creator_id', creatorProfile.id)
    .in('order_status', ['accepted', 'in_progress', 'shipped', 'delivered'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(3);

  const recentActiveOrders = (recentActiveOrdersData ?? []) as any[];

  // Fetch recent open inquiries (up to 3)
  const { data: recentInquiriesData } = await supabase
    .from('inquiries')
    .select('*, profiles(full_name, username, avatar_url), listings(title)')
    .eq('creator_id', creatorProfile.id)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(3);

  const recentInquiries = (recentInquiriesData ?? []) as any[];

  // Calculate profile completion
  let completionPercent = 0;
  const missingSteps = [];
  if (profile.avatar_url || creatorProfile.profile_image_url) completionPercent += 20; else missingSteps.push('Upload avatar picture');
  if (creatorProfile.display_name) completionPercent += 20; else missingSteps.push('Set creator display name');
  if (creatorProfile.bio) completionPercent += 20; else missingSteps.push('Write workspace tagline/bio');
  if (creatorProfile.skills && creatorProfile.skills.length > 0) completionPercent += 20; else missingSteps.push('Add listing skills');
  if (creatorProfile.cover_image_url) completionPercent += 20; else missingSteps.push('Upload brand cover banner');

  // Fetch engagement totals
  const { data: postsData } = await supabase
    .from('creator_posts')
    .select('like_count, save_count, view_count')
    .eq('creator_profile_id', creatorProfile.id)
    .is('deleted_at', null);

  const totalLikes = postsData?.reduce((acc, p) => acc + (p.like_count || 0), 0) ?? 0;
  const totalSaves = postsData?.reduce((acc, p) => acc + (p.save_count || 0), 0) ?? 0;
  const totalViews = postsData?.reduce((acc, p) => acc + (p.view_count || 0), 0) ?? 0;

  const inquiryConversion = totalInquiries > 0 ? Math.round((completedOrdersCount / totalInquiries) * 100) : 100;

  return (
    <DashboardShell
      title="Creator Workspace"
      description="Track performance, oversee listing specs, publish feed updates, and handle custom orders."
    >
      <div className="space-y-6 text-slate-800">
        
        {/* Profile Completion Widget */}
        {completionPercent < 100 && (
          <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-white p-5 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Complete Your Creator Profile ({completionPercent}%)
                  </h3>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                  Improve buyer trust and increase conversions by finishing your setup. Complete these missing steps to achieve 100% profile completion.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingSteps.map((step) => (
                    <span key={step} className="px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-semibold text-slate-600 border border-slate-200 shadow-sm">
                      + {step}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-750 active:scale-[0.98] text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm whitespace-nowrap"
              >
                Complete Workspace Setup
              </Link>
            </div>
          </section>
        )}

        {/* Top Metric Cards */}
        <section className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Earnings */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50/20 via-white to-white p-5 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Total Earnings</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                <HeartHandshake className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 leading-none">{formatCurrency(totalEarnings, currency)}</p>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">From {completedOrdersCount} completed orders</p>
          </div>

          {/* Active Orders */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/20 via-white to-white p-5 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Active Orders</span>
              <span className="p-2 rounded-xl bg-indigo-50/70 text-indigo-600 border border-indigo-100/50">
                <ShoppingBag className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 leading-none">{activeOrdersCount}</p>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Currently in production</p>
          </div>

          {/* Pending Inquiries */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50/20 via-white to-white p-5 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Pending Inquiries</span>
              <span className="p-2 rounded-xl bg-amber-50/70 text-amber-600 border border-amber-100/50">
                <HelpCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 leading-none">{pendingInquiriesCount}</p>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">Awaiting your response</p>
          </div>

          {/* Response Rate */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50/20 via-white to-white p-5 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Response Rate</span>
              <span className="p-2 rounded-xl bg-purple-50/70 text-purple-600 border border-purple-100/50">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 leading-none">{responseRate}%</p>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              India marketplace avg: 85%
            </p>
          </div>
        </section>

        {/* Supporting Growths & Direct Stats */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
          {/* Followers count with growth */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-slate-650 shadow-sm shrink-0">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Followers</p>
              <p className="text-lg font-black text-slate-800 leading-none mt-1">{followersCount}</p>
              <p className="text-[9px] text-emerald-650 font-bold mt-1">
                {followerGrowthRate > 0 ? `+${followerGrowthRate}%` : 'Stable'} last 30d
              </p>
            </div>
          </div>

          {/* Portfolio Views */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-slate-650 shadow-sm shrink-0">
              <Eye className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Portfolio Views</p>
              <p className="text-lg font-black text-slate-800 leading-none mt-1">{totalViews}</p>
              <p className="text-[9px] text-slate-500 font-semibold mt-1">Cumulative reach</p>
            </div>
          </div>

          {/* Saved Listings */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-slate-650 shadow-sm shrink-0">
              <Heart className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Saved Listings</p>
              <p className="text-lg font-black text-slate-800 leading-none mt-1">{totalSavesCount}</p>
              <p className="text-[9px] text-slate-500 font-semibold mt-1">Bookmarked by buyers</p>
            </div>
          </div>

          {/* Messages */}
          <Link href="/messages" className="flex items-center gap-3 hover:opacity-85 transition shrink-0 group">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-slate-650 shadow-sm shrink-0 group-hover:border-indigo-400 group-hover:text-indigo-650 transition">
              <MessageSquare className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Unread Chats</p>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-lg font-black text-slate-800 leading-none">{unreadMessagesCount}</p>
                {unreadMessagesCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 font-bold text-white uppercase animate-pulse">New</span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 font-semibold mt-1">Open direct inbox</p>
            </div>
          </Link>
        </section>

        {/* Performance Analytics Grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Performance Analytics
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Realtime updates</span>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Reach and Engagement */}
            <div className="p-4 rounded-xl border border-slate-150 bg-slate-50/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-850">Portfolio Engagement</span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Engagement breakdown across published feed updates.</p>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                    <span>Likes ({totalLikes})</span>
                    <span>{totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0}% ratio</span>
                  </div>
                  <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${totalViews > 0 ? Math.min(100, Math.round((totalLikes / totalViews) * 100)) : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                    <span>Saves ({totalSaves})</span>
                    <span>{totalViews > 0 ? Math.round((totalSaves / totalViews) * 100) : 0}% ratio</span>
                  </div>
                  <div className="w-full bg-slate-155 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${totalViews > 0 ? Math.min(100, Math.round((totalSaves / totalViews) * 100)) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Inquiry Conversion Funnel */}
            <div className="p-4 rounded-xl border border-slate-150 bg-slate-50/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-850">Inquiry Conversion</span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Percentage of inquiries successfully converted into completed orders.</p>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 leading-none">{inquiryConversion}%</span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    vs India Avg (35%)
                  </span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden mt-3">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, inquiryConversion)}%` }} />
                </div>
              </div>
            </div>

            {/* Response Health & Speed */}
            <div className="p-4 rounded-xl border border-slate-150 bg-slate-50/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-850">Response Health & Speed</span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Evaluation of reply efficiency and communications reliability.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">Average Response Time</span>
                  <span className="text-xs font-bold text-indigo-650">&lt; 2 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">Active Status</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-150 font-bold text-indigo-700">Top Seller Speed</span>
                </div>
                <div className="mt-1 pt-1.5 border-t border-slate-200/50">
                  <p className="text-[9px] text-slate-550 font-medium leading-normal">
                    {responseRate >= 80 
                      ? '✨ Excellent - Fast response builds buyer trust and improves listing ranks.' 
                      : '⚠️ Attention - Fast response is key. Reply promptly to improve orders.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions, Activity, and Split Action Center */}
        <div className="grid gap-6 md:grid-cols-12">
          
          {/* Work Action Center split columns */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Active Work Orders */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-slate-450" />
                  Active Work Orders ({activeOrdersCount})
                </h3>
                <Link href="/dashboard/creator/orders" className="text-[10px] font-bold text-indigo-650 hover:underline">
                  Manage all orders
                </Link>
              </div>

              {recentActiveOrders.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">No active orders in production</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-1 leading-normal">
                    When buyers order your listings or custom order quotes, they will appear here as active projects.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentActiveOrders.map((order) => {
                    const badge = getActiveOrderStatusBadge(order.order_status);
                    const buyerName = order.profiles?.full_name || order.profiles?.username || 'Client';
                    const buyerInitials = buyerName.substring(0, 2).toUpperCase();
                    const title = order.listings?.title || order.custom_orders?.title || 'Standard Order';
                    const deadlineDate = order.custom_orders?.deadline;

                    return (
                      <div key={order.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                        <div className="flex items-start gap-3">
                          {/* Client Avatar/Initials */}
                          <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-650 flex items-center justify-center text-xs font-bold border border-slate-200 shrink-0 uppercase">
                            {order.profiles?.avatar_url ? (
                              <img src={order.profiles.avatar_url} alt={buyerName} className="h-full w-full object-cover rounded-xl" />
                            ) : (
                              buyerInitials
                            )}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-650 transition">
                              {title}
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              Client: {buyerName} {order.profiles?.username && `(@${order.profiles.username})`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="text-right space-y-0.5">
                            <p className="text-xs font-black text-slate-900">{formatCurrency(order.amount, order.currency)}</p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {deadlineDate ? `Due: ${formatDate(deadlineDate)}` : 'Standard delivery'}
                            </p>
                          </div>

                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label}
                          </span>

                          <Link
                            href={`/dashboard/creator/orders/${order.id}`}
                            className="p-1 rounded-lg border border-slate-200 hover:border-indigo-400 text-slate-400 hover:text-indigo-650 bg-slate-50 hover:bg-indigo-50/30 transition shadow-sm"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Awaiting Response Inquiries */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-450" />
                  Inquiries Awaiting Response ({pendingInquiriesCount})
                </h3>
                <Link href="/dashboard/creator/inquiries" className="text-[10px] font-bold text-indigo-650 hover:underline">
                  Manage inquiries
                </Link>
              </div>

              {recentInquiries.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">All caught up!</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-1 leading-normal">
                    You have no unresolved inquiries. When buyers message you about your listings, they will show up here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentInquiries.map((inquiry) => {
                    const buyerName = inquiry.profiles?.full_name || inquiry.profiles?.username || 'Buyer';
                    const buyerInitials = buyerName.substring(0, 2).toUpperCase();
                    const listingTitle = inquiry.listings?.title || 'General Custom Inquiry';
                    const messageSnippet = inquiry.message.length > 90 ? `${inquiry.message.substring(0, 87)}...` : inquiry.message;

                    return (
                      <div key={inquiry.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                        <div className="flex items-start gap-3">
                          {/* Buyer Avatar/Initials */}
                          <div className="h-9 w-9 rounded-xl bg-slate-105 text-slate-650 flex items-center justify-center text-xs font-bold border border-slate-200 shrink-0 uppercase">
                            {inquiry.profiles?.avatar_url ? (
                              <img src={inquiry.profiles.avatar_url} alt={buyerName} className="h-full w-full object-cover rounded-xl" />
                            ) : (
                              buyerInitials
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-650 transition">
                                {buyerName}
                              </h4>
                              <span className="text-[9px] text-slate-400 font-semibold">
                                on {listingTitle}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-normal max-w-lg italic font-medium">
                              &ldquo;{messageSnippet}&rdquo;
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className="text-[9px] text-slate-400 font-bold">
                            {formatDate(inquiry.created_at)}
                          </span>

                          <Link
                            href="/dashboard/creator/inquiries"
                            className="px-2.5 py-1 rounded-lg border border-indigo-200 hover:border-indigo-400 text-indigo-700 bg-indigo-50/40 hover:bg-indigo-50/80 text-xs font-bold transition shadow-sm"
                          >
                            Reply
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Area: Shortcuts & Timeline */}
          <div className="md:col-span-4 space-y-6">
            
            {/* Workspace Shortcuts Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-slate-400" />
                Workspace Shortcuts
              </h3>
              <div className="grid gap-2">
                <Link
                  href={`/u/${profile.username}/posts/new`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-650 group-hover:bg-indigo-50 group-hover:text-indigo-650 transition">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    Create Post
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                </Link>
                <Link
                  href="/dashboard/creator/listings"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-650 group-hover:bg-indigo-50 group-hover:text-indigo-650 transition">
                      <Tag className="h-3.5 w-3.5" />
                    </span>
                    Manage Listings
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                </Link>
                <Link
                  href="/dashboard/creator/custom-orders"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-650 group-hover:bg-indigo-50 group-hover:text-indigo-650 transition">
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </span>
                    Custom Quotes
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                </Link>
                <Link
                  href="/dashboard/profile"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-650 group-hover:bg-indigo-50 group-hover:text-indigo-650 transition">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    Edit Profile
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                </Link>
                {profile.username && (
                  <Link
                    href={`/u/${profile.username}`}
                    target="_blank"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="p-1 rounded bg-slate-100 text-slate-655 group-hover:bg-indigo-50 group-hover:text-indigo-655 transition">
                        <Star className="h-3.5 w-3.5" />
                      </span>
                      View Public Profile
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                  </Link>
                )}
                <Link
                  href="/dashboard/creator/verification"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-650 group-hover:bg-indigo-50 group-hover:text-indigo-650 transition">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    Request Verification
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-655 transition" />
                </Link>
              </div>
            </div>

            {/* Workspace Activity Timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-450" />
                Workspace Status
              </h3>
              
              {/* If no listings -> Empty state */}
              {totalListings === 0 ? (
                <div className="rounded-xl border border-slate-200 border-dashed bg-slate-50/40 p-5 flex flex-col items-center justify-center text-center shadow-inner">
                  <div className="p-2.5 rounded-full bg-white border border-slate-150 text-slate-400 text-xl mb-3 shadow-sm">
                    🎨
                  </div>
                  <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Create a listing</h4>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Start showcasing your skills to prospective buyers. Add package pricing, descriptions, and samples.
                  </p>
                  <Link 
                    href="/dashboard/creator/listings" 
                    className="mt-4 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-550 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition duration-150 shadow-md shadow-indigo-600/10"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add First Listing</span>
                  </Link>
                </div>
              ) : totalPosts === 0 ? (
                /* If listings exist but no posts -> Empty state */
                <div className="rounded-xl border border-slate-200 border-dashed bg-slate-50/40 p-5 flex flex-col items-center justify-center text-center shadow-inner">
                  <div className="p-2.5 rounded-full bg-white border border-slate-150 text-slate-400 text-xl mb-3 shadow-sm">
                    📸
                  </div>
                  <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Publish a post</h4>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Engage followers by showing your creative process, latest commission updates, or design highlights.
                  </p>
                  <Link 
                    href={`/u/${profile.username}/posts/new`} 
                    className="mt-4 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-550 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition duration-150 shadow-md shadow-indigo-600/10"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Publish First Post</span>
                  </Link>
                </div>
              ) : (
                /* Active status timeline */
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-805">Listings Visible ({activeListings}/{totalListings})</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Approved service packages are currently discoverable by clients.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 border-l border-slate-150 pl-3.5 relative ml-3">
                    <div className="absolute -left-1 w-2 h-2 rounded-full bg-indigo-600" style={{ top: '16px' }} />
                    <div className="shrink-0 p-1.5 rounded-lg bg-indigo-50 text-indigo-650 border border-indigo-100">
                      <HeartHandshake className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-805">Portfolio Active</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Your published feed posts ({totalPosts}) are visible to building followers.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </DashboardShell>
  );
}