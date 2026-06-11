'use server';

import { createWebServerClient } from '~/lib/supabase/server';
import { updateMediaPresentationMetadata, softDeleteCurrentUserMedia } from '@rosovia/api';

export async function updatePortfolioMetadataAction(
  mediaId: string,
  title: string,
  description: string
) {
  const supabase = createWebServerClient();
  try {
    const serialized = JSON.stringify({ title, description });
    const media = await updateMediaPresentationMetadata(supabase, mediaId, {
      alt_text: serialized,
    });
    return { success: true, media };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deletePortfolioItemAction(mediaId: string) {
  const supabase = createWebServerClient();
  try {
    await softDeleteCurrentUserMedia(supabase, mediaId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
