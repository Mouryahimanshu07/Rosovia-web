import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const dynamic = 'force-dynamic';

const buyerActions = [
  {
    title: 'Browse Listings',
    description: 'Discover products, services, mentorship, workshops, and performances.',
    href: '/listings',
    icon: '🛍️',
    primary: true,
  },
  {
    title: 'Discover Creators',
    description: 'Find verified artisans, coders, designers, teachers, and skilled professionals.',
    href: '/creators',
    icon: '👥',
    primary: false,
  },
  {
    title: 'My Orders',
    description: 'Track payments, delivery status, and completed purchases.',
    href: '/dashboard/buyer/orders',
    icon: '📦',
    primary: false,
  },
  {
    title: 'Custom Orders',
    description: 'Manage custom work requests sent to creators.',
    href: '/dashboard/buyer/custom-orders',
    icon: '🎨',
    primary: false,
  },
  {
    title: 'Inquiries',
    description: 'View your questions and conversations with creators.',
    href: '/dashboard/buyer/inquiries',
    icon: '💬',
    primary: false,
  },
  {
    title: 'Reviews',
    description: 'Review completed orders and manage your feedback.',
    href: '/dashboard/buyer/reviews',
    icon: '⭐',
    primary: false,
  },
  {
    title: 'Reports',
    description: 'Report suspicious listings, users, or marketplace issues.',
    href: '/dashboard/buyer/reports',
    icon: '🛡️',
    primary: false,
  },
];

export default async function BuyerDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'buyer') redirect('/dashboard/' + profile.role);

  return (
    <DashboardShell
      title="Buyer Dashboard"
      description={`Welcome back${profile.full_name ? ', ' + profile.full_name : ''}. Manage your marketplace activity from one place.`}
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-950 to-gray-800 p-6 text-white shadow-sm">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-gray-300">Buyer workspace</p>
            <h2 className="mt-2 text-2xl font-bold">
              Find talent, order services, and track everything professionally.
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Use Rosovia to discover verified creators, request custom work,
              manage orders, and review completed purchases.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gray-100"
              >
                Browse Listings
              </Link>
              <Link
                href="/creators"
                className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Find Creators
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
            <p className="text-sm text-gray-500">
              Continue with the most important buyer workflows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {buyerActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
                  item.primary
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl ${
                      item.primary ? 'bg-white/10' : 'bg-gray-100'
                    }`}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <h3
                      className={`font-semibold ${
                        item.primary ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={`mt-1 text-sm leading-6 ${
                        item.primary ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {item.description}
                    </p>
                    <p
                      className={`mt-3 text-sm font-medium ${
                        item.primary ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Open →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}