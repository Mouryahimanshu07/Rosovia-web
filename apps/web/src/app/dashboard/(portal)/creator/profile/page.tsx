import { redirect } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';

export const dynamic = 'force-dynamic';

export default async function CreatorProfileRedirectPage() {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.username) {
    redirect(`/u/${profile.username}/edit`);
  }

  redirect(`/dashboard/${profile.role}`);
}
