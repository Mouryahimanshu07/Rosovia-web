import Link from 'next/link';
import { Bell, MessageCircle } from 'lucide-react';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getDashboardRedirectPath, getUnreadCountForCurrentUser, getUnreadMessageCountForCurrentUser } from '@rosovia/api';


export async function AppHeader() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  const dashboardPath = profile ? getDashboardRedirectPath(profile.role) : null;

  let unreadCount = 0;
  let unreadMessagesCount = 0;
  if (profile) {
    try {
      unreadCount = await getUnreadCountForCurrentUser(supabase);
    } catch (e) {
      console.error('Failed to fetch unread notification count:', e);
    }
    try {
      unreadMessagesCount = await getUnreadMessageCountForCurrentUser(supabase);
    } catch (e) {
      console.error('Failed to fetch unread messages count:', e);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-950">
          Rosovia
        </Link>

        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/explore" className="text-gray-600 hover:text-gray-950">
            Explore
          </Link>

          {profile && dashboardPath ? (
            <>
              <Link
                href="/dashboard/messages"
                className="text-gray-600 hover:text-gray-950 flex items-center gap-1.5"
              >
                <span>Messages</span>
                {unreadMessagesCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white ring-1 ring-white">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </Link>

              {profile.username && (
                <Link
                  href={`/u/${profile.username}`}
                  className="text-gray-600 hover:text-gray-950"
                >
                  Profile
                </Link>
              )}

              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-950"
              >
                Dashboard
              </Link>

              <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700 sm:inline-flex">
                {profile.role}
              </span>

              <Link
                href="/dashboard/notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-50 hover:text-gray-950 transition-all duration-200"
                title="Notifications"
                id="header-notification-bell"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white ring-1 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/logout"
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
              >
                Log out
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-950">
                Log in
              </Link>

              <Link
                href="/signup"
                className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}