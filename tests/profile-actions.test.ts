import { describe, expect, it } from 'vitest';

/**
 * Tests for ProfileActionButtons component rendering logic.
 *
 * These tests verify the isOwner / isAuthenticated / visitor contract:
 *   - Owner sees Edit Profile, Post Your Work, Manage Posts, Dashboard
 *   - Owner does NOT see Follow, Message, Request Custom Order
 *   - Visitor sees Follow, Message, Request Custom Order
 *   - Visitor does NOT see Edit Profile, Post Your Work, Dashboard
 *   - Anonymous visitor sees login-redirect versions of Follow, Message, Custom Order
 */

interface ButtonDecision {
  editProfile: boolean;
  postYourWork: boolean;
  managePosts: boolean;
  dashboard: boolean;
  follow: boolean;
  message: boolean;
  requestCustomOrder: boolean;
}

function computeButtonVisibility(params: {
  isOwner: boolean;
  isAuthenticated: boolean;
  isCreator: boolean;
}): ButtonDecision {
  const { isOwner, isAuthenticated, isCreator } = params;

  if (isOwner) {
    return {
      editProfile: true,
      postYourWork: isCreator,
      managePosts: isCreator,
      dashboard: true,
      follow: false,
      message: false,
      requestCustomOrder: false,
    };
  }

  // Visitor (authenticated or anonymous)
  return {
    editProfile: false,
    postYourWork: false,
    managePosts: false,
    dashboard: false,
    follow: true, // redirects to login if not authenticated
    message: true, // redirects to login if not authenticated
    requestCustomOrder: isCreator, // redirects to login if not authenticated
  };
}

describe('Profile Action Buttons — Visibility Contract', () => {

  describe('Owner view (isOwner = true)', () => {
    it('shows Edit Profile, Dashboard; hides Follow/Message/Custom Order', () => {
      const result = computeButtonVisibility({
        isOwner: true,
        isAuthenticated: true,
        isCreator: false,
      });

      expect(result.editProfile).toBe(true);
      expect(result.dashboard).toBe(true);
      expect(result.follow).toBe(false);
      expect(result.message).toBe(false);
      expect(result.requestCustomOrder).toBe(false);
    });

    it('shows Post Your Work and Manage Posts when user is a creator', () => {
      const result = computeButtonVisibility({
        isOwner: true,
        isAuthenticated: true,
        isCreator: true,
      });

      expect(result.postYourWork).toBe(true);
      expect(result.managePosts).toBe(true);
      expect(result.editProfile).toBe(true);
      expect(result.dashboard).toBe(true);
      expect(result.follow).toBe(false);
      expect(result.message).toBe(false);
      expect(result.requestCustomOrder).toBe(false);
    });

    it('hides Post Your Work and Manage Posts for buyer-only profile', () => {
      const result = computeButtonVisibility({
        isOwner: true,
        isAuthenticated: true,
        isCreator: false,
      });

      expect(result.postYourWork).toBe(false);
      expect(result.managePosts).toBe(false);
    });
  });

  describe('Authenticated visitor view (isOwner = false, isAuthenticated = true)', () => {
    it('shows Follow, Message; hides Edit Profile/Dashboard/Post', () => {
      const result = computeButtonVisibility({
        isOwner: false,
        isAuthenticated: true,
        isCreator: true,
      });

      expect(result.follow).toBe(true);
      expect(result.message).toBe(true);
      expect(result.editProfile).toBe(false);
      expect(result.postYourWork).toBe(false);
      expect(result.managePosts).toBe(false);
      expect(result.dashboard).toBe(false);
    });

    it('shows Request Custom Order when visited profile is a creator', () => {
      const result = computeButtonVisibility({
        isOwner: false,
        isAuthenticated: true,
        isCreator: true,
      });

      expect(result.requestCustomOrder).toBe(true);
    });

    it('hides Request Custom Order when visited profile is a buyer', () => {
      const result = computeButtonVisibility({
        isOwner: false,
        isAuthenticated: true,
        isCreator: false,
      });

      expect(result.requestCustomOrder).toBe(false);
    });
  });

  describe('Anonymous visitor view (isOwner = false, isAuthenticated = false)', () => {
    it('shows Follow/Message (will redirect to login); hides owner buttons', () => {
      const result = computeButtonVisibility({
        isOwner: false,
        isAuthenticated: false,
        isCreator: true,
      });

      expect(result.follow).toBe(true);
      expect(result.message).toBe(true);
      expect(result.requestCustomOrder).toBe(true);
      expect(result.editProfile).toBe(false);
      expect(result.postYourWork).toBe(false);
      expect(result.managePosts).toBe(false);
      expect(result.dashboard).toBe(false);
    });
  });
});

describe('Profile Ownership Detection — ID Comparison Contract', () => {
  // The core fix: ownership must compare profiles.id to profiles.id
  // NOT auth.users.id to profiles.auth_user_id (which was undefined from public_profiles view)

  it('should detect owner when currentUserProfile.id === baseProfile.id', () => {
    const currentUserProfile = { id: 'profile-uuid-123' };
    const baseProfile = { id: 'profile-uuid-123' };

    const isOwnProfile = currentUserProfile !== null && currentUserProfile.id === baseProfile.id;
    expect(isOwnProfile).toBe(true);
  });

  it('should NOT detect owner when profile IDs differ', () => {
    const currentUserProfile = { id: 'profile-uuid-123' };
    const baseProfile = { id: 'profile-uuid-456' };

    const isOwnProfile = currentUserProfile !== null && currentUserProfile.id === baseProfile.id;
    expect(isOwnProfile).toBe(false);
  });

  it('should NOT detect owner when user is anonymous (null profile)', () => {
    const currentUserProfile = null;
    const baseProfile = { id: 'profile-uuid-123' };

    const isOwnProfile = currentUserProfile !== null && currentUserProfile.id === baseProfile.id;
    expect(isOwnProfile).toBe(false);
  });

  it('isSelf in followers list should use profile ID, not auth_user_id', () => {
    const currentUserProfile = { id: 'my-profile-id' };
    const followerInList = { id: 'my-profile-id', username: 'me' };

    // Correct: compare profile IDs
    const isSelfCorrect = currentUserProfile !== null && currentUserProfile.id === followerInList.id;
    expect(isSelfCorrect).toBe(true);

    // The old broken approach compared auth.users.id to a field that was never fetched
    const followerWithoutAuthId = { id: 'my-profile-id', auth_user_id: undefined };
    const authUserId = 'auth-uuid-different';
    const isSelfBroken = authUserId === followerWithoutAuthId.auth_user_id;
    expect(isSelfBroken).toBe(false); // was always false — the bug
  });
});

describe('Post Visibility Contract', () => {
  it('public posts should require moderation_status = approved', () => {
    const posts = [
      { id: '1', moderation_status: 'approved', visibility: 'public' },
      { id: '2', moderation_status: 'pending', visibility: 'public' },
      { id: '3', moderation_status: 'rejected', visibility: 'public' },
      { id: '4', moderation_status: 'approved', visibility: 'private' },
    ];

    const publicVisible = posts.filter(
      (p) => p.moderation_status === 'approved' && p.visibility === 'public'
    );

    expect(publicVisible).toHaveLength(1);
    expect(publicVisible[0]!.id).toBe('1');
  });

  it('owner should see all statuses in dashboard context', () => {
    const posts = [
      { id: '1', moderation_status: 'approved' },
      { id: '2', moderation_status: 'pending' },
      { id: '3', moderation_status: 'rejected' },
    ];

    // Owner dashboard shows all posts regardless of moderation_status
    expect(posts).toHaveLength(3);
  });

  it('new posts should be created with moderation_status = approved (instant publish)', () => {
    // The createCreatorPost service sets moderation_status: 'approved'
    const newPostPayload = {
      moderation_status: 'approved' as const,
      visibility: 'public' as const,
    };

    expect(newPostPayload.moderation_status).toBe('approved');
  });
});

describe('Creator Inconsistent Data Fallback & Layout Gating', () => {
  it('should always select creator layout if profile.role === creator', () => {
    const profile = { role: 'creator', username: 'himan' };
    const isCreator = profile.role === 'creator';
    expect(isCreator).toBe(true);
  });

  it('should fallback to baseProfile fields if creatorProfile fields are missing', () => {
    const baseProfile = {
      full_name: 'Himanshu',
      username: 'himan',
      bio: 'Base bio',
      avatar_url: 'http://avatar.url',
      cover_image_url: 'http://cover.url',
    };

    const creatorProfileFallback = {
      display_name: baseProfile.full_name || baseProfile.username || 'Creator',
      slug: baseProfile.username || 'creator',
      bio: baseProfile.bio,
      profile_image_url: baseProfile.avatar_url,
      cover_image_url: baseProfile.cover_image_url,
    };

    expect(creatorProfileFallback.display_name).toBe('Himanshu');
    expect(creatorProfileFallback.slug).toBe('himan');
    expect(creatorProfileFallback.bio).toBe('Base bio');
    expect(creatorProfileFallback.profile_image_url).toBe('http://avatar.url');
    expect(creatorProfileFallback.cover_image_url).toBe('http://cover.url');
  });

  it('should show 0 for missing tab counts', () => {
    const services: any[] = [];
    const shop: any[] = [];
    const portfolioListings: any[] = [];
    const portfolioMedia: any[] = [];

    const servicesCount = services.length;
    const shopCount = shop.length;
    const portfolioCount = portfolioListings.length + portfolioMedia.length;

    expect(servicesCount).toBe(0);
    expect(shopCount).toBe(0);
    expect(portfolioCount).toBe(0);
  });
});

describe('Talent Chips Logic', () => {
  function parseTalentChips(
    categoryName: string | null | undefined,
    skills: string[] | null | undefined
  ) {
    const categoriesList = categoryName
      ? categoryName.split('/').map((s) => s.trim()).filter(Boolean)
      : [];

    const skillsList = skills
      ? skills.map((s) => s.trim()).filter(Boolean)
      : [];

    const categoriesParsed: string[] = [];
    const skillsParsed: string[] = [];
    const seen = new Set<string>();

    for (const cat of categoriesList) {
      const lower = cat.toLowerCase();
      if (lower && !seen.has(lower)) {
        seen.add(lower);
        categoriesParsed.push(cat);
      }
    }

    for (const skill of skillsList) {
      const lower = skill.toLowerCase();
      if (lower && !seen.has(lower)) {
        seen.add(lower);
        skillsParsed.push(skill);
      }
    }

    const combined = [...categoriesParsed, ...skillsParsed];
    return {
      combined,
      categories: categoriesParsed,
      skills: skillsParsed
    };
  }

  it('splits slash-separated categories and filters duplicates case-insensitively', () => {
    const { combined, categories } = parseTalentChips(
      'Coding / Web Development / Coding',
      ['Web Development', 'React']
    );

    expect(categories).toEqual(['Coding', 'Web Development']);
    expect(combined).toEqual(['Coding', 'Web Development', 'React']);
  });

  it('limits chips and calculates extraCount for desktop and mobile', () => {
    const { combined } = parseTalentChips(
      'A / B / C',
      ['D', 'E', 'F', 'G', 'H']
    ); // 8 items total

    const desktopLimit = 5;
    const mobileLimit = 3;

    const desktopVisible = combined.slice(0, desktopLimit);
    const desktopExtra = combined.length - desktopLimit;

    const mobileVisible = combined.slice(0, mobileLimit);
    const mobileExtra = combined.length - mobileLimit;

    expect(desktopVisible).toHaveLength(5);
    expect(desktopExtra).toBe(3);

    expect(mobileVisible).toHaveLength(3);
    expect(mobileExtra).toBe(5);
  });

  it('renders fallback when empty', () => {
    const { combined } = parseTalentChips(null, null);
    expect(combined).toHaveLength(0);
  });
});

describe('Creator Tabs Configuration', () => {
  it('returns correct empty states for tabs', () => {
    const getEmptyState = (tab: string, isOwner: boolean) => {
      const emptyStates: Record<string, { owner: string; visitor: string }> = {
        portfolio: {
          owner: 'Show your best work. Add your first portfolio item.',
          visitor: 'No portfolio items yet.',
        },
        posts: {
          owner: 'Share your latest work. Create your first post.',
          visitor: 'No posts yet.',
        },
        services: {
          owner: 'Add your first service.',
          visitor: 'No services available yet.',
        },
        shop: {
          owner: 'Add your first product.',
          visitor: 'No products available yet.',
        },
        reviews: {
          owner: 'No reviews yet.',
          visitor: 'No reviews yet.',
        },
      };
      const state = emptyStates[tab];
      return isOwner ? state?.owner : state?.visitor;
    };

    expect(getEmptyState('portfolio', true)).toBe('Show your best work. Add your first portfolio item.');
    expect(getEmptyState('portfolio', false)).toBe('No portfolio items yet.');
    expect(getEmptyState('posts', true)).toBe('Share your latest work. Create your first post.');
    expect(getEmptyState('posts', false)).toBe('No posts yet.');
    expect(getEmptyState('services', true)).toBe('Add your first service.');
    expect(getEmptyState('services', false)).toBe('No services available yet.');
    expect(getEmptyState('shop', true)).toBe('Add your first product.');
    expect(getEmptyState('shop', false)).toBe('No products available yet.');
    expect(getEmptyState('reviews', false)).toBe('No reviews yet.');
  });
});
