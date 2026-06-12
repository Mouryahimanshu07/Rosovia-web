import { redirect } from 'next/navigation';
import { createWebServerClient, getServerProfile } from '~/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NAV_LINKS = [
  { href: '/dashboard/admin', label: 'Overview', icon: '🏠' },
  { href: '/dashboard/admin/users', label: 'Users', icon: '👥' },
  { href: '/dashboard/admin/creators', label: 'Creators', icon: '🎨' },
  { href: '/dashboard/admin/categories', label: 'Categories', icon: '🗂️' },
  { href: '/dashboard/admin/listings', label: 'Listings', icon: '📋' },
  { href: '/dashboard/admin/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/dashboard/admin/orders', label: 'Orders', icon: '📦' },
  { href: '/dashboard/admin/payments', label: 'Payments', icon: '💳' },
  { href: '/dashboard/admin/audit-logs', label: 'Audit Logs', icon: '📜' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getServerProfile();
  const supabase = createWebServerClient();

  // Server-side auth gate
  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-gray-300">ROSOVIA</span>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-medium text-white">Admin Console</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{profile.full_name ?? profile.email ?? 'Admin'}</span>
          <a href="/dashboard/admin" className="hover:text-white transition">Dashboard</a>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-52 min-h-[calc(100vh-48px)] bg-white border-r border-gray-200 shrink-0">
          <nav className="p-3 space-y-0.5">
            {NAV_LINKS.map(({ href, label, icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <span className="text-base" aria-hidden="true">{icon}</span>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
