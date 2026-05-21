import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '~/lib/supabase/admin';
import { handleRazorpayWebhook } from '@rosovia/api';
import { captureAppError } from '~/lib/analytics/capture-error';

/**
 * POST /api/webhooks/razorpay
 *
 * Receives Razorpay webhook events.
 *
 * Security:
 * - Reads raw body as text BEFORE any JSON parsing.
 * - Verifies HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET.
 * - Uses service-role Supabase client for trusted writes (bypasses RLS).
 * - Never requires user session.
 * - Returns 400 on invalid signature, 200 on success or duplicate.
 */
export async function POST(req: NextRequest) {
  // Read raw body as text — required for signature verification
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // Extract signature from header
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!signature) {
    return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
  }

  try {
    // Use admin client — no user session available in webhook context
    const adminSupabase = createAdminSupabaseClient();

    const result = await handleRazorpayWebhook(adminSupabase, rawBody, signature);

    if (result.duplicate) {
      // Return 200 for duplicates — prevent Razorpay retries
      return NextResponse.json({ ok: true, message: result.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true, message: result.message }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing error';

    // Invalid signature → 400 (do not expose details)
    if (message.includes('Invalid webhook signature')) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Real server error → 500 (Razorpay will retry)
    console.error('Razorpay webhook error:', err);
    captureAppError(err, { module: 'payments', action: 'razorpay_webhook' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
