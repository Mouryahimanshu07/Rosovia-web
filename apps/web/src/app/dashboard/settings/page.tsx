import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { Shield, Bell, Key, UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsDashboardPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  return (
    <DashboardShell
      title="Settings"
      description="Manage your account security, notification alerts, and safety configurations."
    >
      <div className="max-w-2xl bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        
        {/* Account Status */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Account Safety
          </h3>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 flex items-center justify-between">
            <div>
              <p className="font-extrabold text-gray-900 capitalize">{profile.role} Account</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Your email identity is {profile.email}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-xs font-black uppercase tracking-wider text-emerald-700 border border-emerald-100">
              ● Active
            </span>
          </div>
        </section>

        {/* Security & Access */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Security & Access
          </h3>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-sm">Two-Factor Authentication (2FA)</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Secure your transaction releases.</p>
              </div>
              <button className="px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 transition">
                Configure
              </button>
            </div>
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-sm">Reset Password</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Change your authentication credentials.</p>
              </div>
              <button className="px-4 py-2 rounded-full bg-gray-950 hover:bg-gray-800 text-xs font-bold text-white transition">
                Request Reset
              </button>
            </div>
          </div>
        </section>

        {/* System Alerts */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="font-bold text-gray-900 text-sm">Email Transaction Alerts</p>
                <p className="text-xs text-gray-400 font-semibold leading-relaxed mt-0.5">Receive automatic order creation and payment success email notifications.</p>
              </div>
              <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
            </div>
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="font-bold text-gray-900 text-sm">Follow Alert Notifications</p>
                <p className="text-xs text-gray-400 font-semibold leading-relaxed mt-0.5">Receive real-time notifications when another user follows your public profile card.</p>
              </div>
              <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
            </div>
          </div>
        </section>
        
      </div>
    </DashboardShell>
  );
}
