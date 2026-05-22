import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';

export const metadata: Metadata = {
  title: 'Reports & Moderation — Admin — Rosovia',
  description: 'Review and moderate reports submitted by users.',
};

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/50 to-orange-50/20 p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl mb-4">
          📢
        </div>
        <h1 className="text-xl font-bold text-gray-900">Content Moderation & Reports De-scoped</h1>
        <p className="text-sm text-gray-500 mt-2">
          The public report flagging queue and custom DB-backed moderation suites have been simplified.
        </p>
        <div className="mt-6 border-t border-gray-100 pt-6 text-left space-y-3">
          <div className="flex gap-3">
            <span className="text-red-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Operational Simplification</p>
              <p className="text-xs text-gray-500 mt-0.5">Database writing on the reports table has been RLS-locked to eliminate DB write spam and complex custom administrative UI maintenance.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Unified Email Flagging</p>
              <p className="text-xs text-gray-500 mt-0.5">Public report button flags are mirrored directly to the support inbox via pre-filled mailto templates targeting <a href="mailto:support@rosovia.com" className="text-indigo-600 hover:underline">support@rosovia.com</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

