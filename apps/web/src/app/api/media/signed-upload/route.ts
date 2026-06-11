import { NextRequest, NextResponse } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';
import { createSignedMediaUpload } from '@rosovia/api';
import { signedUploadRequestSchema } from '@rosovia/core';
import { rateLimit } from '~/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signedUploadRequestSchema.safeParse(body);
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

    // Rate limiting: 10 per minute
    const limitRes = await rateLimit(user.id, 10, 60000);
    if (!limitRes.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Pre-check R2 config
    const r2Configured =
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME;

    if (!r2Configured) {
      return NextResponse.json(
        { error: 'Upload service is currently unavailable due to configuration. Please contact support.' },
        { status: 500 }
      );
    }

    const result = await createSignedMediaUpload(supabase, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const isConfigError =
      errorMsg.includes('credentials') ||
      errorMsg.includes('configuration') ||
      errorMsg.includes('endpoint') ||
      errorMsg.includes('R2') ||
      errorMsg.includes('S3');

    const friendlyMessage = isConfigError
      ? 'Upload service is currently unavailable due to configuration. Please contact support.'
      : errorMsg;

    console.error('[media/signed-upload] Error:', errorMsg, err);
    return NextResponse.json({ error: friendlyMessage }, { status: 500 });
  }
}
