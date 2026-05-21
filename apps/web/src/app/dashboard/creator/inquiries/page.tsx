import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCreatorInquiriesForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { InquiryCard } from '~/components/inquiry/inquiry-card';
import { InquiryReplyForm } from '~/components/inquiry/inquiry-reply-form';
import { CreatorInquiryActions } from './creator-inquiry-actions';

export const metadata = {
  title: 'Inquiries — Creator Dashboard — Rosovia',
};

export default async function CreatorInquiriesPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const inquiries = await listCreatorInquiriesForCurrentUser(supabase);

  return (
    <DashboardShell
      title="Inquiries"
      description="Inquiries sent to you by buyers."
    >
      {inquiries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">📬</div>
          <p className="text-sm font-medium text-gray-700">No inquiries yet</p>
          <p className="text-xs text-gray-500 mt-1">
            When buyers send you inquiries, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => {
            const canReply = inquiry.status === 'open';
            const canClose = ['open', 'replied'].includes(inquiry.status);
            const canMarkSpam = ['open', 'replied'].includes(inquiry.status);

            return (
              <InquiryCard
                key={inquiry.id}
                inquiry={inquiry}
                viewAs="creator"
                actions={
                  <div className="space-y-3">
                    {/* Reply form — only if open and not yet replied */}
                    {canReply && !inquiry.creator_response && (
                      <InquiryReplyForm inquiryId={inquiry.id} />
                    )}
                    {/* Status action buttons */}
                    {(canClose || canMarkSpam) && (
                      <CreatorInquiryActions
                        inquiryId={inquiry.id}
                        canClose={canClose}
                        canMarkSpam={canMarkSpam}
                      />
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
