import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';

export const metadata: Metadata = {
  title: 'Disputes — Admin — Rosovia',
};

export const dynamic = 'force-dynamic';

export default async function AdminDisputesPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/20 p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-2xl mb-4">
          ⚖️
        </div>
        <h1 className="text-xl font-bold text-gray-900">Disputes Moderation De-scoped</h1>
        <p className="text-sm text-gray-500 mt-2">
          Direct database-backed dispute arbitration has been simplified to reduce platform complexity. 
        </p>
        <div className="mt-6 border-t border-gray-100 pt-6 text-left space-y-3">
          <div className="flex gap-3">
            <span className="text-blue-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Operational Simplification</p>
              <p className="text-xs text-gray-500 mt-0.5">Custom DB table disputing and 3-way UI flows are disabled to zero out administrative management overhead.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Email Escalation Engine</p>
              <p className="text-xs text-gray-500 mt-0.5">Order escalation requests and arbitration are handled directly via email tickets at <a href="mailto:support@rosovia.com" className="text-indigo-600 hover:underline">support@rosovia.com</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

