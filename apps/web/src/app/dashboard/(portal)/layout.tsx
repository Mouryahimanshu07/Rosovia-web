import Link from 'next/link';
import { redirect } from 'next/navigation';
import { 
  LayoutDashboard, 
  ListTodo, 
  ShoppingBag, 
  Settings as SettingsIcon,
  Palette,
} from 'lucide-react';

import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getDashboardRedirectPath } from '@rosovia/api';

export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const isCreator = profile.role === 'creator';
  const isBuyer = profile.role === 'buyer';
  const isAdmin = profile.role === 'admin';

  // Construct dynamic href targets based on user role
  const dashboardPath = getDashboardRedirectPath(profile.role);
  const ordersPath = isCreator ? '/dashboard/creator/orders' : '/dashboard/buyer/orders';

  // Sidebar navigation — Dashboard | My Listings | My Portfolio | Orders | Settings
  // (Edit Profile and My Posts are in /u/[username], Messages is in top navbar)
  const sidebarLinks = [
    {
      label: 'Dashboard',
      href: dashboardPath,
      icon: LayoutDashboard,
      visible: true
    },
    {
      label: 'My Listings',
      href: '/dashboard/creator/listings',
      icon: ListTodo,
      visible: isCreator || isAdmin
    },
    {
      label: 'My Portfolio',
      href: '/dashboard/portfolio',
      icon: Palette,
      visible: isCreator
    },
    {
      label: 'Orders',
      href: ordersPath,
      icon: ShoppingBag,
      visible: !isAdmin
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: SettingsIcon,
      visible: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* ── PREMIUM DASHBOARD SIDEBAR ──────────────────────── */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0 relative z-20">
        <div className="h-full flex flex-col p-6 space-y-8">
          
          {/* User profile brief */}
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-gray-50 border border-gray-100/50">
            <div className="w-10 h-10 rounded-xl overflow-hidden relative bg-indigo-50 border border-gray-100 flex-shrink-0 flex items-center justify-center font-bold text-indigo-600">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (profile.full_name || profile.username || 'R').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-gray-900 truncate max-w-full">
                {profile.full_name || profile.username}
              </p>
              <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest mt-0.5">
                {profile.role}
              </p>
            </div>
          </div>

          {/* Navigation link group */}
          <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-1.5 pb-2 md:pb-0 scrollbar-none">
            {sidebarLinks.map((link) => {
              if (!link.visible) return null;
              const Icon = link.icon;
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-gray-500 hover:bg-indigo-50/50 hover:text-indigo-600 border border-transparent hover:border-indigo-100/30 transition-all duration-200 whitespace-nowrap"
                >
                  <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Decorative premium onboarding card if buyer */}
          {isBuyer && (
            <div className="hidden md:block rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-4 text-white shadow-md relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200">Start Selling</p>
              <h4 className="font-extrabold text-xs mt-1.5">Become a Creator</h4>
              <p className="text-[10px] text-indigo-100 mt-1 leading-relaxed">Publish listings and showcase posts to buyers nationwide.</p>
              <Link 
                href="/dashboard/profile" 
                className="mt-3 inline-flex items-center justify-center w-full py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-50 shadow-sm active:scale-95 transition"
              >
                Upgrade Profile
              </Link>
            </div>
          )}

        </div>
      </aside>

      {/* ── MAIN DASHBOARD VIEWPORT ────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-4 px-2 sm:px-4 md:py-8 md:px-8">
          {children}
        </div>
      </main>

    </div>
  );
}
