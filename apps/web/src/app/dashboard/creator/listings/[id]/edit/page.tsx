import { redirect, notFound } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, getCurrentCreatorProfile, getListingById, listMediaByListingId } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { ListingForm } from '~/components/forms/listing-form';
import { ListingMediaUpload } from '~/components/media/listing-media-upload';
import type { DbCategory, MediaAsset } from '@rosovia/core';

async function getActiveCategories(supabase: ReturnType<typeof createWebServerClient>): Promise<DbCategory[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  return (data ?? []) as DbCategory[];
}

interface Props {
  params: { id: string };
}

export default async function CreatorListingEditPage({ params }: Props) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  const creatorProfile = await getCurrentCreatorProfile(supabase);
  if (!creatorProfile) redirect('/dashboard/creator/profile/new');

  // Fetch listing + categories + media all in parallel
  const [listing, categories, existingMedia] = await Promise.all([
    getListingById(supabase, params.id),
    getActiveCategories(supabase),
    listMediaByListingId(supabase, params.id),
  ]);

  if (!listing) notFound();
  // Ensure creator owns this listing
  if (listing.creator_id !== creatorProfile.id) notFound();

  return (
    <DashboardShell
      title="Edit Listing"
      description={`Editing: ${listing.title}`}
    >
      <div className="max-w-2xl space-y-8">
        {/* Listing details form */}
        <ListingForm mode="edit" categories={categories} existingListing={listing} />

        {/* Listing image upload */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Listing Images</h2>
          <ListingMediaUpload listingId={listing.id} existingMedia={existingMedia as MediaAsset[]} />
        </div>
      </div>
    </DashboardShell>
  );
}
