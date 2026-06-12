import { redirect, notFound } from 'next/navigation';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile } from '@rosovia/api';
import { DashboardShell } from '@rosovia/ui';
import { EditPortfolioForm } from './edit-portfolio-form';

interface EditPortfolioPageProps {
  params: {
    id: string;
  };
}

export default async function EditPortfolioPage({ params }: EditPortfolioPageProps) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'creator') redirect('/dashboard/' + profile.role);

  // Fetch the portfolio item
  const { data: media, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !media) {
    notFound();
  }

  // Security check: ensure current user is owner
  if (media.owner_id !== profile.id) {
    redirect('/dashboard/portfolio');
  }

  // Parse title and description from alt_text json
  let initialTitle = '';
  let initialDescription = '';
  if (media.alt_text) {
    try {
      const parsed = JSON.parse(media.alt_text);
      if (parsed && typeof parsed === 'object') {
        initialTitle = parsed.title || '';
        initialDescription = parsed.description || '';
      }
    } catch {
      initialTitle = media.alt_text;
    }
  }

  return (
    <DashboardShell
      title="Edit Portfolio Work"
      description="Update the title and description details for your portfolio showcase item."
    >
      <div className="max-w-2xl">
        <EditPortfolioForm
          mediaId={media.id}
          initialTitle={initialTitle}
          initialDescription={initialDescription}
          mediaUrl={media.public_url}
          mediaType={media.media_type}
        />
      </div>
    </DashboardShell>
  );
}
