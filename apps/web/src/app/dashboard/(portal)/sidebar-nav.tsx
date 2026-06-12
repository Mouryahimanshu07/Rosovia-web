'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Rss,
  MessageSquare,
  FileText,
  Tag,
  Briefcase,
  HelpCircle,
  Star,
  User,
  Settings as SettingsIcon,
  ShieldAlert
} from 'lucide-react';

interface SidebarNavProps {
  role: string;
  username: string | null;
  dashboardPath: string;
  unreadMessagesCount: number;
}

export function SidebarNav({ role, username, dashboardPath, unreadMessagesCount }: SidebarNavProps) {
  const pathname = usePathname();

  const isCreator = role === 'creator';
  const isBuyer = role === 'buyer';
  const isAdmin = role === 'admin';

  const sidebarLinks = [
    {
      label: 'Dashboard',
      href: dashboardPath,
      icon: LayoutDashboard,
      visible: true
    },
    {
      label: 'Work Feed',
      href: '/explore?tab=work',
      icon: Rss,
      visible: true
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageSquare,
      visible: true,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined
    },
    {
      label: 'My Posts',
      href: username ? `/u/${username}/posts` : '#',
      icon: FileText,
      visible: isCreator || isAdmin
    },
    {
      label: 'Listings',
      href: isCreator || isAdmin ? '/dashboard/creator/listings' : '/listings',
      icon: Tag,
      visible: true
    },
    {
      label: 'Custom Orders',
      href: isCreator ? '/dashboard/creator/custom-orders' : '/dashboard/buyer/custom-orders',
      icon: Briefcase,
      visible: !isAdmin
    },
    {
      label: 'Inquiries',
      href: isCreator ? '/dashboard/creator/inquiries' : '/dashboard/buyer/inquiries',
      icon: HelpCircle,
      visible: !isAdmin
    },
    {
      label: 'Reviews',
      href: isCreator ? '/dashboard/creator/reviews' : '/dashboard/buyer/reviews',
      icon: Star,
      visible: !isAdmin
    },
    {
      label: 'Profile',
      href: username ? `/u/${username}` : '/dashboard/profile',
      icon: User,
      visible: true
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: SettingsIcon,
      visible: true
    },
    {
      label: 'Admin',
      href: '/dashboard/admin',
      icon: ShieldAlert,
      visible: isAdmin
    }
  ];

  return (
    <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-1.5 pb-2 md:pb-0 scrollbar-none flex-1">
      {sidebarLinks.map((link) => {
        if (!link.visible) return null;
        const Icon = link.icon;
        
        // Exact match or matches sub-pages (e.g. /dashboard/messages?id=... matches /dashboard/messages)
        const isActive = pathname === link.href || 
          (link.href !== '/' && link.href !== dashboardPath && pathname.startsWith(link.href.split('?')[0] ?? ''));

        return (
          <Link
            key={link.label}
            href={link.href}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 whitespace-nowrap ${
              isActive 
                ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-bold shadow-sm shadow-indigo-500/5' 
                : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`h-4.5 w-4.5 flex-shrink-0 transition-colors duration-200 ${
                isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'
              }`} />
              <span>{link.label}</span>
            </div>
            {link.badge !== undefined && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
