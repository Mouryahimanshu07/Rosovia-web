'use server';

import { createWebServerClient } from '~/lib/supabase/server';
import { createCurrentUserCreatorProfile, updateCurrentUserCreatorProfile } from '@rosovia/api';
import type { CreatorProfileCreateInput, CreatorProfileUpdateInput } from '@rosovia/core';

export async function createCreatorProfileAction(input: CreatorProfileCreateInput) {
  const supabase = createWebServerClient();
  try {
    const profile = await createCurrentUserCreatorProfile(supabase, input);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateCreatorProfileAction(id: string, input: CreatorProfileUpdateInput) {
  const supabase = createWebServerClient();
  try {
    const profile = await updateCurrentUserCreatorProfile(supabase, id, input);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
