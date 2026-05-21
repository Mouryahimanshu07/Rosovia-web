import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminAction,
  getMediaAssetById,
  getProfileByAuthUserId,
} from '@rosovia/api';
import { createSignedReadUrl } from '@rosovia/integrations';
import { createWebServerClient } from '~/lib/supabase/server';

export const runtime = 'nodejs';

interface RouteContext {
  params: {
    id: string;
  };
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const mediaId = context.params.id;

    if (!mediaId || !isValidUuid(mediaId)) {
      return NextResponse.json(
        { error: 'Invalid media ID' },
        { status: 400 }
      );
    }

    const supabase = createWebServerClient();

    // -----------------------------------------------------------------------
    // 1. Resolve current user
    // -----------------------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Check profile.role === admin
    // -----------------------------------------------------------------------

    const profile = await getProfileByAuthUserId(supabase, user.id);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (profile.status !== 'active') {
      return NextResponse.json(
        { error: 'Your account is not active' },
        { status: 403 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // -----------------------------------------------------------------------
    // 3. Fetch media asset
    // -----------------------------------------------------------------------

    const media = await getMediaAssetById(supabase, mediaId);

    if (!media) {
      return NextResponse.json(
        { error: 'Media asset not found' },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // 4. Ensure media.is_private === true
    // -----------------------------------------------------------------------

    if (!media.is_private) {
      return NextResponse.json(
        { error: 'Signed read URL is only available for private media' },
        { status: 400 }
      );
    }

    if (!media.storage_key.startsWith('private/')) {
      return NextResponse.json(
        { error: 'Invalid private media storage key' },
        { status: 400 }
      );
    }

    if (media.status === 'deleted') {
      return NextResponse.json(
        { error: 'Media asset has been deleted' },
        { status: 410 }
      );
    }

    // -----------------------------------------------------------------------
    // 5. Create signed read URL
    // -----------------------------------------------------------------------

    const signedRead = await createSignedReadUrl(media.storage_key);

    // -----------------------------------------------------------------------
    // 6. Insert admin_actions log
    // -----------------------------------------------------------------------
    // Current admin_actions type/constraint does not include "media_asset".
    // So we log it as a manual_note against the media owner's user profile,
    // with the media access details stored in metadata.
    // -----------------------------------------------------------------------

    await createAdminAction(supabase, {
      admin_id: profile.id,
      action_type: 'manual_note',
      target_type: 'user',
      target_id: media.owner_id,
      note: 'Admin generated a temporary signed read URL for private media.',
      metadata: {
        media_id: media.id,
        media_type: media.media_type,
        mime_type: media.mime_type,
        size_bytes: media.size_bytes,
        storage_key: media.storage_key,
        purpose: 'private_media_signed_read',
        expires_in_seconds: signedRead.expiresIn,
      },
    });

    // -----------------------------------------------------------------------
    // 7. Return signed URL
    // -----------------------------------------------------------------------

    return NextResponse.json({
      mediaId: media.id,
      signedUrl: signedRead.signedUrl,
      expiresIn: signedRead.expiresIn,
    });
  } catch (err) {
    console.error('Admin private media signed-read error:', err);

    return NextResponse.json(
      { error: 'Failed to create signed read URL' },
      { status: 500 }
    );
  }
}