import { describe, expect, it, beforeEach, vi } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('Rate Limiter Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows requests within the configured limits and returns correct remaining counts', async () => {
    const clientId = 'client_1';

    // 1st request
    const res1 = await rateLimit(clientId, 3, 60000);
    expect(res1.success).toBe(true);
    expect(res1.limit).toBe(3);
    expect(res1.remaining).toBe(2);

    // 2nd request
    const res2 = await rateLimit(clientId, 3, 60000);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    // 3rd request
    const res3 = await rateLimit(clientId, 3, 60000);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks subsequent requests exceeding the configured limit', async () => {
    const clientId = 'client_2';

    // Exhaust limits
    await rateLimit(clientId, 2, 60000);
    await rateLimit(clientId, 2, 60000);

    // 3rd request (exceeds limit of 2)
    const res = await rateLimit(clientId, 2, 60000);
    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it('resets the rate limit window after the reset interval has passed', async () => {
    const clientId = 'client_3';

    // Exhaust limits
    await rateLimit(clientId, 1, 60000);
    const blockedRes = await rateLimit(clientId, 1, 60000);
    expect(blockedRes.success).toBe(false);

    // Advance system time past the 60 seconds reset window
    vi.advanceTimersByTime(61000);

    // Try again — should be allowed now
    const allowedRes = await rateLimit(clientId, 1, 60000);
    expect(allowedRes.success).toBe(true);
    expect(allowedRes.remaining).toBe(0);
  });

  it('segregates request counters and reset windows for distinct client keys', async () => {
    const clientA = 'client_a';
    const clientB = 'client_b';

    // Exhaust limits for Client A
    await rateLimit(clientA, 1, 60000);
    const blockedA = await rateLimit(clientA, 1, 60000);
    expect(blockedA.success).toBe(false);

    // Client B should still be allowed since keys are isolated
    const allowedB = await rateLimit(clientB, 1, 60000);
    expect(allowedB.success).toBe(true);
    expect(allowedB.remaining).toBe(0);
  });
});
