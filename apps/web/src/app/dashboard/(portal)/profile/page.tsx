import { redirect } from 'next/navigation';
import { getServerProfile } from '~/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RedirectToNewProfileEditPage() {
  const profile = await getServerProfile();

  if (!profile) redirect('/login');
  if (profile.username) {
    redirect(`/u/${profile.username}/edit`);
  }

  // Fallback if no username set
  redirect(`/dashboard/${profile.role}`);
}
