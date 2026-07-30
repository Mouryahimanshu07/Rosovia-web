import Link from 'next/link';
import { redirect } from 'next/navigation';
import { 
  Bell,
  Plus,
  MessageSquare
} from 'lucide-react';

import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';
import { getDashboardRedirectPath, getUnreadCountForCurrentUser, getUnreadMessageCountForCurrentUser } from '@rosovia/api';
import { SidebarNav } from './sidebar-nav';
import { DashboardSearchInput } from '~/components/dashboard/DashboardSearchInput';
import { RealtimeBadge } from '~/components/dashboard/realtime-badge';

export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const profile = await getServerProfile();
  const supabase = createWebServerClient();

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const isCreator = profile.role === 'creator';
  const isBuyer = profile.role === 'buyer';

  // Construct dynamic href targets based on user role
  const dashboardPath = getDashboardRedirectPath(profile.role);
  const unreadMessagesCount = await getUnreadMessageCountForCurrentUser(supabase).catch(() => 0);
  const unreadNotificationsCount = await getUnreadCountForCurrentUser(supabase).catch(() => 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row antialiased">
      
      {/* ── PREMIUM DASHBOARD SIDEBAR ──────────────────────── */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 relative z-20 flex flex-col justify-between">
        <div className="p-6 space-y-6 flex-1 flex flex-col">
          {/* User profile brief */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-xl overflow-hidden relative bg-indigo-55/10 border border-indigo-100 flex-shrink-0 flex items-center justify-center font-bold text-indigo-600">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (profile.full_name || profile.username || 'R').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {profile.full_name || profile.username}
              </p>
              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/60 rounded-md mt-0.5 uppercase tracking-wide">
                {profile.role}
              </span>
            </div>
          </div>

          {/* Navigation link group */}
          <SidebarNav
            role={profile.role}
            username={profile.username}
            dashboardPath={dashboardPath}
            unreadMessagesCount={unreadMessagesCount}
          />
          
          {/* Decorative premium onboarding card if buyer */}
          {isBuyer && (
            <div className="hidden md:block rounded-2xl bg-gradient-to-br from-indigo-700 to-purple-800 p-4 text-white shadow-xl relative overflow-hidden border border-indigo-600/30">
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200">Start Selling</p>
              <h4 className="font-extrabold text-xs mt-1">Become a Creator</h4>
              <p className="text-[10px] text-indigo-100 mt-1 leading-relaxed">Publish listings and showcase posts to buyers nationwide.</p>
              <Link 
                href="/dashboard/profile" 
                className="mt-3 inline-flex items-center justify-center w-full py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-50 shadow-md active:scale-95 transition"
              >
                Upgrade Profile
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN VIEWPORT with TOP HEADER ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 backdrop-blur px-6">
          {/* Search bar */}
          <DashboardSearchInput />

          <div className="flex items-center gap-4 ml-auto">
            {/* Create button */}
            {isCreator && (
              <Link
                href="/dashboard/creator/listings"
                className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Listing</span>
              </Link>
            )}

            {/* Notifications Shortcut */}
            <Link
              href="/dashboard/notifications"
              className="relative p-1.5 text-slate-500 hover:text-slate-800 transition rounded-lg hover:bg-slate-100"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              <RealtimeBadge initialCount={unreadNotificationsCount} profileId={profile.id} type="notifications" />
            </Link>

            {/* Messages Shortcut */}
            <Link
              href="/messages"
              className="relative p-1.5 text-slate-500 hover:text-slate-800 transition rounded-lg hover:bg-slate-100"
              title="Messages"
            >
              <MessageSquare className="h-4.5 w-4.5" />
              <RealtimeBadge initialCount={unreadMessagesCount} profileId={profile.id} type="messages" />
            </Link>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200" />

            {/* User Profile avatar menu */}
            <Link
              href={profile.username ? `/u/${profile.username}` : '/dashboard/profile'}
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden relative bg-indigo-50 border border-indigo-100 flex-shrink-0 flex items-center justify-center font-bold text-indigo-600">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile.full_name || profile.username || 'R').charAt(0).toUpperCase()
                )}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto py-6 px-4 md:py-8 md:px-8">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
