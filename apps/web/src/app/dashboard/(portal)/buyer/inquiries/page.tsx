import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listBuyerInquiriesForCurrentUser } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { InquiryCard } from '~/components/inquiry/inquiry-card';
import { BuyerInquiryActions } from './buyer-inquiry-actions';
import { MessageOrderPartyButton } from '~/components/order/message-order-party-button';

export const metadata = {
  title: 'My Inquiries — Rosovia',
};

export default async function BuyerInquiriesPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');

  const inquiries = await listBuyerInquiriesForCurrentUser(supabase);

  return (
    <DashboardShell
      title="My Inquiries"
      description="Inquiries you have sent to creators."
    >
      {inquiries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl mb-3">✉️</div>
          <p className="text-sm font-medium text-gray-700">No inquiries yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Browse creators or listings and send an inquiry to get started.
          </p>
          <div className="mt-4 flex gap-3 justify-center">
            <a
              href="/creators"
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              Browse Creators
            </a>
            <a
              href="/listings"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Browse Listings
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              viewAs="buyer"
              actions={
                <div className="flex items-center gap-3 flex-wrap">
                  {['open', 'replied'].includes(inquiry.status) ? (
                    <BuyerInquiryActions inquiryId={inquiry.id} />
                  ) : undefined}
                  {/* Chat with Creator shortcut — only if creator_id is available */}
                  {inquiry.creator_id && (
                    <MessageOrderPartyButton
                      creatorId={inquiry.creator_id}
                      viewAs="buyer"
                    />
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
