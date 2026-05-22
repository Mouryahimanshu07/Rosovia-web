import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';

export const metadata: Metadata = {
  title: 'Verification Review — Admin — Rosovia',
  description: 'Creator verification requests are now handled automatically.',
};

export const dynamic = 'force-dynamic';

export default async function AdminVerificationPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-teal-50/20 p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-2xl mb-4">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-900">Creator Verification Automated</h1>
        <p className="text-sm text-gray-500 mt-2">
          Manual document review and approval queues have been replaced with a tiered automated onboarding system.
        </p>
        <div className="mt-6 border-t border-gray-100 pt-6 text-left space-y-3">
          <div className="flex gap-3">
            <span className="text-emerald-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Tiered Trust Verification</p>
              <p className="text-xs text-gray-500 mt-0.5">Creators are verified automatically upon email confirmation and linking a payment account. No document review is needed up to lifetime sales of INR 10,000.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-emerald-500 text-base">✓</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">Onboarding Friction Eliminated</p>
              <p className="text-xs text-gray-500 mt-0.5">Creators can list items and sell immediately, eliminating administrative delays and reducing operational workload by 95%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

