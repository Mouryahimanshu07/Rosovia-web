import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Lightweight health check for uptime monitoring.
 * Returns app status and timestamp.
 * No database check — intentionally kept trivial for zero latency.
 * No secrets are exposed.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'rosovia',
    timestamp: new Date().toISOString(),
  });
}
