import { NextRequest, NextResponse } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';
import { saveUploadedMediaMetadata, attachMediaToCreatorProfile } from '@rosovia/api';
import { mediaMetadataCreateSchema } from '@rosovia/core';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the incoming metadata (excludes privileged fields)
    const parsed = mediaMetadataCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const supabase = createWebServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save metadata — server derives owner_id, public_url, storage_provider
    const media = await saveUploadedMediaMetadata(supabase, parsed.data);

    // If profile image, auto-attach to creator_profiles.profile_image_url
    if (parsed.data.usage === 'profile_image' && media.status === 'approved') {
    await attachMediaToCreatorProfile(supabase, media.id);
    }

    return NextResponse.json({ media });
  } catch (err) {
    console.error('Media complete error:', err);
    return NextResponse.json({ error: 'Failed to process media upload' }, { status: 500 });
  }
}
