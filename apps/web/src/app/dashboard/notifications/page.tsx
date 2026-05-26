// apps/web/src/app/dashboard/notifications/page.tsx

import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCurrentUserNotifications } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { NotificationsDashboardClient } from './notifications-dashboard-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Notifications — Rosovia',
  description: 'Manage and view your marketplace notifications.',
};

export default async function NotificationsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  // Fetch notifications
  const notifications = await listCurrentUserNotifications(supabase).catch(() => []);

  return (
    <DashboardShell
      title="Notifications"
      description="Stay updated with activities in your inbox, custom orders, and inquiries."
    >
      <NotificationsDashboardClient
        initialNotifications={notifications}
        userRole={profile.role}
      />
    </DashboardShell>
  );
}
