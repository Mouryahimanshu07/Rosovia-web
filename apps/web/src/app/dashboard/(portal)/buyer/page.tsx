import Link from 'next/link';
import { redirect } from 'next/navigation';
import { 
  ShoppingBag, 
  Heart, 
  MessageSquare, 
  User, 
  Sparkles, 
  CheckCircle,
  Star,
  ExternalLink,
  Compass,
  Settings
} from 'lucide-react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getUnreadMessageCountForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const dynamic = 'force-dynamic';

export default async function BuyerDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'buyer') redirect('/dashboard/' + profile.role);

  // Fetch metrics/counts in parallel
  const [
    savedListingsRes,
    savedCreatorsRes,
    customOrdersRes,
    inquiriesRes,
    reviewsRes,
    followingRes,
    unreadMessagesCount
  ] = await Promise.all([
    supabase.from('saved_listings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('saved_creators').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('custom_orders').select('*', { count: 'exact', head: true }).eq('buyer_id', profile.id),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('buyer_id', profile.id),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('buyer_id', profile.id),
    supabase.from('creator_follows').select('*', { count: 'exact', head: true }).eq('follower_profile_id', profile.id),
    getUnreadMessageCountForCurrentUser(supabase).catch(() => 0)
  ]);

  const savedCount = (savedListingsRes.count ?? 0) + (savedCreatorsRes.count ?? 0);
  const activeOrdersCount = customOrdersRes.count ?? 0;
  const inquiryCount = inquiriesRes.count ?? 0;
  const reviewsCount = reviewsRes.count ?? 0;
  const followingCount = followingRes.count ?? 0;

  // Calculate profile completion
  let completionPercent = 0;
  const missingSteps = [];
  if (profile.full_name) completionPercent += 20; else missingSteps.push('Add your full name');
  if (profile.username) completionPercent += 20; else missingSteps.push('Choose a username');
  if (profile.phone) completionPercent += 20; else missingSteps.push('Add phone number');
  if (profile.avatar_url) completionPercent += 20; else missingSteps.push('Upload avatar photo');
  if (profile.bio) completionPercent += 20; else missingSteps.push('Write short bio description');

  return (
    <DashboardShell
      title="Buyer Workspace"
      description="Track orders, coordinate with creators, and bookmark listings & creative talent."
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
                    Complete Your Profile ({completionPercent}%)
                  </h3>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Unlock all buyer features, including verified reviews and customized quote proposals, by finishing your profile setup.
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
                Complete Profile Setup
              </Link>
            </div>
          </section>
        )}

        {/* Overview Stats Grid */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          
          {/* Saved Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Items</span>
              <span className="p-2.5 rounded-xl bg-indigo-55/10 text-indigo-600 border border-indigo-100/50"><Heart className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{savedCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Listings and creators</p>
          </div>

          {/* Custom Orders */}
          <Link
            href="/dashboard/buyer/custom-orders"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Orders</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><ShoppingBag className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{activeOrdersCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Projects requested</p>
          </Link>

          {/* Total Inquiries */}
          <Link
            href="/dashboard/buyer/inquiries"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inquiries</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><MessageSquare className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{inquiryCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Chat threads opened</p>
          </Link>

          {/* Reviews Given */}
          <Link
            href="/dashboard/buyer/reviews"
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 block text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reviews Given</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><Star className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{reviewsCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Marketplace feedback</p>
          </Link>

          {/* Following count */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Following</span>
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/50"><User className="h-4.5 w-4.5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{followingCount}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Creators followed</p>
          </div>

          {/* New Messages */}
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
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-650 font-bold text-white uppercase animate-pulse">Unread</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Check message inbox</p>
          </Link>

        </section>

        {/* Quick Actions & Activity Section */}
        <div className="grid gap-6 md:grid-cols-12">
          
          {/* Quick Actions Panel */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid gap-2">
              <Link
                href="/listings"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Browse Listings</span>
                <Compass className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              <Link
                href="/creators"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Find Creators</span>
                <User className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
              <Link
                href="/dashboard/messages"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Check Inbox</span>
                <MessageSquare className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
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
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
                </Link>
              )}
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-600 shadow-sm group"
              >
                <span>Account Settings</span>
                <Settings className="h-4 w-4 text-slate-400 group-hover:text-indigo-650 transition" />
              </Link>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Activity</h3>
            
            {/* Empty States */}
            {inquiryCount === 0 && activeOrdersCount === 0 ? (
              <div className="rounded-2xl border border-slate-200 border-dashed bg-slate-50 p-10 flex flex-col items-center justify-center text-center shadow-inner">
                <div className="p-3.5 rounded-full bg-white border border-slate-200 text-slate-400 text-3xl mb-4 shadow-sm">
                  🛍️
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Your workspace is empty</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Start by exploring Indian creator listings, showcasing artisan works, and hiring a customized coder or creator.
                </p>
                <Link 
                  href="/explore" 
                  className="mt-5 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition duration-150 shadow-md shadow-indigo-600/10"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Explore Marketplace</span>
                </Link>
              </div>
            ) : (
              /* Activity list */
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 mt-0.5">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Profile Setup Completed</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Welcome to Rosovia! You are ready to coordinate with verified creator talents and request commissions.
                    </p>
                  </div>
                </div>

                {inquiryCount > 0 && (
                  <div className="flex items-start gap-4 border-l border-slate-200 pl-4 relative ml-3.5">
                    <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-slate-200 border-2 border-white" />
                    <div className="shrink-0 p-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Inquiries Active</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        You have submitted {inquiryCount} inquiry tickets to our verified creators. Open the Messages inbox to check replies.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}