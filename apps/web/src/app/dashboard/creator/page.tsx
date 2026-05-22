import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';

export const dynamic = 'force-dynamic';

const creatorActions = [
  {
    title: 'Creator Profile',
    description: 'Set up or update your public creator profile, skills, location, and bio.',
    href: '/dashboard/creator/profile',
    icon: '👤',
    primary: true,
  },
  {
    title: 'My Listings',
    description: 'Create and manage products, services, mentorships, classes, and performances.',
    href: '/dashboard/creator/listings',
    icon: '📌',
    primary: true,
  },
  {
    title: 'Orders',
    description: 'Manage paid orders, delivery progress, and customer completion.',
    href: '/dashboard/creator/orders',
    icon: '📦',
    primary: false,
  },
  {
    title: 'Custom Orders',
    description: 'Review custom requests, send quotes, accept or reject proposals.',
    href: '/dashboard/creator/custom-orders',
    icon: '🎨',
    primary: false,
  },
  {
    title: 'Inquiries',
    description: 'Reply to buyer questions and convert interest into orders.',
    href: '/dashboard/creator/inquiries',
    icon: '💬',
    primary: false,
  },
  {
    title: 'Verification',
    description: 'Request verification and build trust with buyers.',
    href: '/dashboard/creator/verification',
    icon: '✅',
    primary: false,
  },
  {
    title: 'Reviews',
    description: 'View buyer feedback, ratings, and marketplace reputation.',
    href: '/dashboard/creator/reviews',
    icon: '⭐',
    primary: false,
  },
  {
    title: 'Payouts & Earnings',
    description: 'Track your earnings, pending settlements, and payout history.',
    href: '/dashboard/creator/payouts',
    icon: '💰',
    primary: false,
  },
];

export default async function CreatorDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  return (
    <DashboardShell
      title="Creator Dashboard"
      description={`Welcome back${profile.full_name ? ', ' + profile.full_name : ''}. Manage your profile, listings, orders, and buyer communication.`}
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-950 to-gray-800 p-6 text-white shadow-sm">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-gray-300">Creator workspace</p>
            <h2 className="mt-2 text-2xl font-bold">
              Build your public profile and start selling your talent.
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Create your creator identity, publish listings, handle buyer
              inquiries, manage custom work, and grow trust through reviews.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard/creator/profile"
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gray-100"
              >
                Manage Profile
              </Link>
              <Link
                href="/dashboard/creator/listings"
                className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Manage Listings
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Creator tools</h2>
            <p className="text-sm text-gray-500">
              Access all connected creator modules from one dashboard.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {creatorActions.map((item) => (
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