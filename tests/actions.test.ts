import { describe, expect, it, vi, beforeEach } from 'vitest';

// Initialize global mock function stores before tests run (called at execution time)
(globalThis as any).followCreatorMock = vi.fn();
(globalThis as any).followProfileMock = vi.fn();
(globalThis as any).sendCurrentUserMessageMock = vi.fn();
(globalThis as any).createCurrentUserReportMock = vi.fn();

// Mock all possible path mappings of @rosovia/api using dynamic delegate wrappers
vi.mock('@rosovia/api', () => ({
  followCreator: (...args: any[]) => (globalThis as any).followCreatorMock(...args),
  followProfile: (...args: any[]) => (globalThis as any).followProfileMock(...args),
  sendCurrentUserMessage: (...args: any[]) => (globalThis as any).sendCurrentUserMessageMock(...args),
  createCurrentUserReport: (...args: any[]) => (globalThis as any).createCurrentUserReportMock(...args),
  unfollowCreator: vi.fn(),
  unfollowProfile: vi.fn(),
}));

vi.mock('../packages/api/src/index', () => ({
  followCreator: (...args: any[]) => (globalThis as any).followCreatorMock(...args),
  followProfile: (...args: any[]) => (globalThis as any).followProfileMock(...args),
  sendCurrentUserMessage: (...args: any[]) => (globalThis as any).sendCurrentUserMessageMock(...args),
  createCurrentUserReport: (...args: any[]) => (globalThis as any).createCurrentUserReportMock(...args),
  unfollowCreator: vi.fn(),
  unfollowProfile: vi.fn(),
}));

vi.mock('../packages/api/dist/index.mjs', () => ({
  followCreator: (...args: any[]) => (globalThis as any).followCreatorMock(...args),
  followProfile: (...args: any[]) => (globalThis as any).followProfileMock(...args),
  sendCurrentUserMessage: (...args: any[]) => (globalThis as any).sendCurrentUserMessageMock(...args),
  createCurrentUserReport: (...args: any[]) => (globalThis as any).createCurrentUserReportMock(...args),
  unfollowCreator: vi.fn(),
  unfollowProfile: vi.fn(),
}));

// Hoisted supabase client and rate limit mocks
vi.mock('~/lib/supabase/server', () => ({
  createWebServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  })),
}));

vi.mock('~/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn(() => '127.0.0.1'),
  })),
}));

// Imports after hoisting
import { rateLimit } from '~/lib/rate-limit';
import { followCreatorAction, followProfileAction } from '~/app/actions/follows';
import { sendMessageAction } from '~/app/messages/actions';
import { createReportAction } from '~/app/actions/reports';

const VALID_CREATOR_UUID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
const VALID_PROFILE_UUID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
const VALID_CONVERSATION_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

describe('Server Actions Rate Limiting and Validation Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, limit: 10, remaining: 9 });
    
    (globalThis as any).followCreatorMock.mockResolvedValue({ success: true });
    (globalThis as any).followProfileMock.mockResolvedValue({ success: true, isFollowing: true, followerCount: 5 });
    (globalThis as any).sendCurrentUserMessageMock.mockResolvedValue({ success: true });
    (globalThis as any).createCurrentUserReportMock.mockResolvedValue({ id: 'rep-123' });
  });

  describe('followCreatorAction and followProfileAction rate limiting', () => {
    it('allows follow action when under rate limit (20/min)', async () => {
      const res = await followCreatorAction(VALID_CREATOR_UUID);
      
      expect(res.success).toBe(true);
      expect(rateLimit).toHaveBeenCalledWith('test-user-id', 20, 60000);
      expect((globalThis as any).followCreatorMock).toHaveBeenCalled();
    });

    it('blocks follow action and returns error when rate limit is exceeded', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, limit: 20, remaining: 0 });
      
      const res = await followCreatorAction(VALID_CREATOR_UUID);
      
      expect(res.success).toBe(false);
      expect(res.error).toContain('Rate limit exceeded');
      expect((globalThis as any).followCreatorMock).not.toHaveBeenCalled();
    });

    it('enforces rate limit for followProfileAction', async () => {
      const res = await followProfileAction(VALID_PROFILE_UUID, 'testuser');
      
      expect(res.success).toBe(true);
      expect(rateLimit).toHaveBeenCalledWith('test-user-id', 20, 60000);
      expect((globalThis as any).followProfileMock).toHaveBeenCalled();
    });
  });

  describe('sendMessageAction rate limiting', () => {
    it('allows sending message when under rate limit (30/min)', async () => {
      const res = await sendMessageAction(VALID_CONVERSATION_UUID, 'Hello there');
      
      expect(res.success).toBe(true);
      expect(rateLimit).toHaveBeenCalledWith('test-user-id', 30, 60000);
      expect((globalThis as any).sendCurrentUserMessageMock).toHaveBeenCalled();
    });

    it('blocks message action and returns error when rate limit is exceeded', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, limit: 30, remaining: 0 });
      
      const res = await sendMessageAction(VALID_CONVERSATION_UUID, 'Hello there');
      
      expect(res.success).toBe(false);
      expect(res.error).toContain('Rate limit exceeded');
      expect((globalThis as any).sendCurrentUserMessageMock).not.toHaveBeenCalled();
    });
  });

  describe('createReportAction rate limiting', () => {
    it('allows creating report when under rate limit (5/min)', async () => {
      const res = await createReportAction({
        targetType: 'user',
        targetId: VALID_PROFILE_UUID,
        reason: 'spam',
        description: 'This is spam content on this profile',
      });
      
      expect(res.success).toBe(true);
      expect(rateLimit).toHaveBeenCalledWith('test-user-id', 5, 60000);
      expect((globalThis as any).createCurrentUserReportMock).toHaveBeenCalled();
    });

    it('blocks report creation and returns error when rate limit is exceeded', async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, limit: 5, remaining: 0 });
      
      const res = await createReportAction({
        targetType: 'user',
        targetId: VALID_PROFILE_UUID,
        reason: 'spam',
        description: 'This is spam content on this profile',
      });
      
      expect(res.success).toBe(false);
      expect(res.error).toContain('Rate limit exceeded');
      expect((globalThis as any).createCurrentUserReportMock).not.toHaveBeenCalled();
    });
  });
});
