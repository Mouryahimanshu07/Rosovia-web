'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import { moderatePostAsAdmin } from '@rosovia/api';
import { adminPostModerationSchema } from '@rosovia/core';
import type { AdminPostModerationSchemaInput } from '@rosovia/core';

type ActionResult = { success: true } | { success: false; error: string };

export async function moderatePostAction(
  input: AdminPostModerationSchemaInput
): Promise<ActionResult> {
  const parsed = adminPostModerationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const supabase = createWebServerClient();

    // Fetch the post creator profile's username for path revalidation
    const { data: postData } = await supabase
      .from('creator_posts')
      .select('creator_profile_id')
      .eq('id', parsed.data.postId)
      .single();

    let username: string | null = null;
    if (postData?.creator_profile_id) {
      const { data: creatorData } = await supabase
        .from('creator_profiles')
        .select('profiles ( username )')
        .eq('id', postData.creator_profile_id)
        .single();

      username = (creatorData?.profiles as any)?.username ?? null;
    }

    // Call service-role atomic post moderation
    await moderatePostAsAdmin(supabase, parsed.data);

    // Revalidate requested paths
    revalidatePath('/dashboard/admin/posts');
    revalidatePath('/explore');
    if (username) {
      revalidatePath(`/u/${username}`);
      revalidatePath(`/u/${username}/posts`);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to moderate post',
    };
  }
}
