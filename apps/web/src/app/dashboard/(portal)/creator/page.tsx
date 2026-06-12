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
  HeartHandshake
} from 'lucide-react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getUnreadMessageCountForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const dynamic = 'force-dynamic';

export default async function CreatorDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

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

  // Fetch metrics in parallel
  const [
    listingsRes,
    activeListingsRes,
    postsRes,
    inquiriesRes,
    customOrdersRes,
    completedOrdersRes,
    followsRes,
    followingRes,
    savedListingsRes,
    savedCreatorsRes,
    unreadMessagesCount
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).eq('status', 'approved').is('deleted_at', null),
    supabase.from('creator_posts').select('*', { count: 'exact', head: true }).eq('creator_profile_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('custom_orders').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).is('deleted_at', null),
    supabase.from('custom_orders').select('*', { count: 'exact', head: true }).eq('creator_id', creatorProfile.id).eq('status', 'completed').is('deleted_at', null),
    supabase.from('creator_follows').select('*', { count: 'exact', head: true }).eq('creator_profile_id', creatorProfile.id),
    supabase.from('creator_follows').select('*', { count: 'exact', head: true }).eq('follower_profile_id', profile.id),
    supabase.from('saved_listings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('saved_creators').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    getUnreadMessageCountForCurrentUser(supabase).catch(() => 0)
  ]);

  const totalListings = listingsRes.count ?? 0;
  const activeListings = activeListingsRes.count ?? 0;
  const totalPosts = postsRes.count ?? 0;
  const inquiryCount = inquiriesRes.count ?? 0;
  const customOrdersCount = customOrdersRes.count ?? 0;
  const completedOrdersCount = completedOrdersRes.count ?? 0;
  const followersCount = creatorProfile.total_followers || followsRes.count || 0;
  const followingCount = followingRes.count ?? 0;
  const savedCount = (savedListingsRes.count ?? 0) + (savedCreatorsRes.count ?? 0);

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

  const inquiryConversion = inquiryCount > 0 ? Math.round((completedOrdersCount / inquiryCount) * 100) : 100;

  return (
    <DashboardShell
      title="Creator Workspace"
      description="Track performance, oversee listing specs, publish feed updates, and handle custom orders."
    >
      <div className="space-y-8 text-slate-800">
        
        {/* Profile Completion Widget */}
        {completionPercent < 100 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Complete Your Creator Profile ({completionPercent}%)
                  </h3>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Attract up to 3x more potential clients by polishing your brand presence. Add missing items to achieve 100% visibility.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {missingSteps.map((step) => (
                    <span key={step} className="px-2 py-0.5 rounded bg-slate-50 text-[9px] font-bold text-slate-600 border border-slate-200 shadow-sm">
                      + {step}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold px-5 py-2.5 h-10 rounded-xl transition shadow-sm"
              >
                Complete Workspace Setup
              </Link>
            </div>
          </section>
        )}

        {/* Dashboard Overview Cards */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          
          {/* Active Listings Stat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Listings</span>
              <span className="p-2.5 rounded-xl bg-indigo-55/10 text-indigo-600 border border-indigo-100/50"><Tag className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{activeListings}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">/{totalListings} total services listed</p>
          </div>

          {/* Portfolio Posts Stat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Posts</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><CheckCircle className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{totalPosts}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Work feed updates published</p>
          </div>

          {/* New Messages Stat */}
          <Link 
            href="/dashboard/messages"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Messages</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><MessageSquare className="h-4.5 w-4.5" /></span>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <p className="text-3xl font-black text-slate-900">{unreadMessagesCount}</p>
              {unreadMessagesCount > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-600 font-bold text-white uppercase animate-pulse">Unread</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Click to open chat inbox</p>
          </Link>

          {/* Followers Stat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Followers</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><Users className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{followersCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Following {followingCount} creators</p>
          </div>

          {/* Reviews/Rating Stat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reviews & Rating</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><Star className="h-4.5 w-4.5" /></span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-4">
              <p className="text-3xl font-black text-slate-900">{creatorProfile.rating_avg > 0 ? creatorProfile.rating_avg.toFixed(1) : '5.0'}</p>
              <span className="text-sm font-black text-amber-500">★</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Based on {creatorProfile.rating_count || 0} client reviews</p>
          </div>

          {/* New Inquiries Stat */}
          <Link
            href="/dashboard/creator/inquiries"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Inquiries</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><HelpCircle className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{inquiryCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Inquiry messages from buyers</p>
          </Link>

          {/* Custom Orders Stat */}
          <Link
            href="/dashboard/creator/custom-orders"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Orders</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><ShoppingBag className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{customOrdersCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">{completedOrdersCount} orders successfully fulfilled</p>
          </Link>

          {/* Saved Posts/Listings Stat */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Items</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><Heart className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{savedCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Listings and creators bookmarked</p>
          </div>

        </section>

        {/* Work Performance Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Work Performance</h3>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* Post Engagement Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-350 transition duration-300 shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Post Engagement</span>
                <span className="text-[10px] text-slate-500">Accumulated across portfolio posts</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-slate-500 text-[9px] font-bold uppercase">Views</span>
                  <span className="text-xs font-black text-slate-800 mt-1 flex items-center justify-center gap-1"><Eye className="h-3 w-3" /> {totalViews}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-slate-500 text-[9px] font-bold uppercase">Likes</span>
                  <span className="text-xs font-black text-slate-800 mt-1 flex items-center justify-center gap-1"><Heart className="h-3 w-3" /> {totalLikes}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-slate-500 text-[9px] font-bold uppercase">Saves</span>
                  <span className="text-xs font-black text-slate-800 mt-1 flex items-center justify-center gap-1"><Sparkles className="h-3 w-3" /> {totalSaves}</span>
                </div>
              </div>
            </div>

            {/* Inquiry Conversion Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-350 transition duration-300 shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Inquiry Conversion</span>
                <span className="text-[10px] text-slate-500">Percentage of inquiries leading to completed orders</span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{inquiryConversion}%</span>
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                  India Avg: 35%
                </span>
              </div>
            </div>

            {/* Response speed */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-300 transition duration-300 shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Response Speed</span>
                <span className="text-[10px] text-slate-500">Average time to reply to buyer inquiries</span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">&lt; 2 hours</span>
                <span className="text-xs font-semibold text-slate-650 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60">
                  <Clock className="h-3.5 w-3.5" />
                  Top Seller
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Quick Actions & Activity */}
        <div className="grid gap-6 md:grid-cols-12">
          
          {/* Quick Actions Panel */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Workspace Shortcuts</h3>
            <div className="grid gap-2">
              <Link
                href={`/u/${profile.username}/posts/new`}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Create Post</span>
                <Plus className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              <Link
                href="/dashboard/creator/listings"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Add Listing</span>
                <Tag className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              <Link
                href="/dashboard/profile"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Edit Profile</span>
                <User className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              {profile.username && (
                <Link
                  href={`/u/${profile.username}`}
                  target="_blank"
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
                >
                  <span>View Public Profile</span>
                  <User className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
                </Link>
              )}
              <Link
                href="/dashboard/messages"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Check Messages</span>
                <MessageSquare className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              <Link
                href="/dashboard/creator/verification"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Request Verification</span>
                <ShieldCheck className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
            </div>
          </div>

          {/* Activity/Notifications Timeline */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Workspace Activity</h3>
            
            {/* If no listings -> Empty state */}
            {totalListings === 0 ? (
              <div className="rounded-2xl border border-slate-200 border-dashed bg-slate-50 p-10 flex flex-col items-center justify-center text-center shadow-inner">
                <div className="p-3.5 rounded-full bg-white border border-slate-200 text-slate-400 text-3xl mb-4 shadow-sm">
                  🎨
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Add your first service/product</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Start showcasing your talents to prospective buyers across India. Add standard package pricing, description, and images.
                </p>
                <Link 
                  href="/dashboard/creator/listings" 
                  className="mt-5 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition duration-150 shadow-md shadow-indigo-600/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Listing</span>
                </Link>
              </div>
            ) : totalPosts === 0 ? (
              /* If listings exist but no posts -> Empty state */
              <div className="rounded-2xl border border-slate-200 border-dashed bg-slate-50 p-10 flex flex-col items-center justify-center text-center shadow-inner">
                <div className="p-3.5 rounded-full bg-white border border-slate-200 text-slate-400 text-3xl mb-4 shadow-sm">
                  📸
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Create your first work post</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Engage followers by showing your creative process, latest commission highlights, or behind-the-scenes designs.
                </p>
                <Link 
                  href={`/u/${profile.username}/posts/new`} 
                  className="mt-5 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition duration-150 shadow-md shadow-indigo-600/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Publish First Post</span>
                </Link>
              </div>
            ) : (
              /* Activity Feed */
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 p-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Active Listings Visible</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Your listings are approved and currently discoverable by Indian buyers in the main explore directory.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 border-l border-slate-250 pl-4 relative ml-3.5">
                  <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-slate-250 border-2 border-white" />
                  <div className="shrink-0 p-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                    <HeartHandshake className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Portfolio Active</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Your work feed updates are published, building audience engagement and trust.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}