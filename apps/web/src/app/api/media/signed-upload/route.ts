import { NextRequest, NextResponse } from 'next/server';
import { createWebServerClient } from '~/lib/supabase/server';
import { createSignedMediaUpload } from '@rosovia/api';
import { signedUploadRequestSchema } from '@rosovia/core';

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

    const result = await createSignedMediaUpload(supabase, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate signed upload URL';
    console.error('[media/signed-upload] Error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
