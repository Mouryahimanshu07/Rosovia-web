import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorProfileCreateInput, CreatorProfileUpdateInput, CreatorProfile, CreatorProfileWithCategory } from '@rosovia/core';
import { generateSlug } from '@rosovia/core';
import { getProfileByAuthUserId } from '../profiles/profile.repository';
import {
  getCreatorProfileByUserId,
  getCreatorProfileBySlug,
  isSlugTaken,
  createCreatorProfile,
  updateCreatorProfile,
  listPublicCreatorProfiles,
  type ListCreatorProfilesParams,
} from './creator-profile.repository';

export { listPublicCreatorProfiles };

/**
 * Generates a unique slug using numeric counter on collision.
 * "ravi-clay-artist" → "ravi-clay-artist-2" → "ravi-clay-artist-3" → ...
 * Falls back to a random hex suffix after 10 attempts.
 */
async function buildUniqueSlug(supabase: SupabaseClient, displayName: string): Promise<string> {
  const base = generateSlug(displayName);
  if (!(await isSlugTaken(supabase, base))) return base;

  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isSlugTaken(supabase, candidate))) return candidate;
  }

  // Emergency fallback: short random hex
  return `${base}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Returns the creator profile for the currently authenticated user, or null.
 */
export async function getCurrentCreatorProfile(
  supabase: SupabaseClient
): Promise<CreatorProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) return null;

  return getCreatorProfileByUserId(supabase, profile.id);
}

/**
 * Returns both the base profile and creator profile for the dashboard.
 */
export async function getCreatorProfileDashboardState(supabase: SupabaseClient): Promise<{
  creatorProfile: CreatorProfile | null;
}> {
  const creatorProfile = await getCurrentCreatorProfile(supabase);
  return { creatorProfile };
}

/**
 * Creates a creator profile for the currently authenticated user.
 * Enforces: role must be creator, status must be active, one profile per user.
 */
export async function createCurrentUserCreatorProfile(
  supabase: SupabaseClient,
  input: CreatorProfileCreateInput
): Promise<CreatorProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await getProfileByAuthUserId(supabase, user.id);
  if (!profile) throw new Error('Profile not found');
  if (profile.role !== 'creator') throw new Error('Only creators can create a creator profile');
  if (profile.status !== 'active') throw new Error('Account is not active');

  // Check not already created
  const existing = await getCreatorProfileByUserId(supabase, profile.id);
  if (existing) throw new Error('Creator profile already exists');

  const slug = await buildUniqueSlug(supabase, input.displayName);

  return createCreatorProfile(supabase, {
    user_id: profile.id,
    display_name: input.displayName,
    slug,
    bio: input.bio ?? null,
    story: input.story ?? null,
    primary_category_id: input.primaryCategoryId ?? null,
    skills: input.skills ?? [],
    languages: input.languages ?? [],
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? 'India',
    profile_image_url: input.profileImageUrl ?? null,
    intro_video_url: input.introVideoUrl ?? null,
    cover_image_url: input.coverImageUrl ?? null,
    headline: input.headline ?? null,
    website_url: input.websiteUrl ?? null,
    profile_theme: input.profileTheme ?? 'default',
  });
}

/**
 * Updates the authenticated creator's profile.
 * Sensitive fields are never passed to the repository.
 */
export async function updateCurrentUserCreatorProfile(
  supabase: SupabaseClient,
  creatorProfileId: string,
  input: CreatorProfileUpdateInput
): Promise<CreatorProfile> {
  // Build safe update payload — explicitly exclude write-protected fields
  const safeData: Parameters<typeof updateCreatorProfile>[2] = {};
  if (input.displayName !== undefined) safeData.display_name = input.displayName;
  if (input.bio !== undefined) safeData.bio = input.bio ?? null;
  if (input.story !== undefined) safeData.story = input.story ?? null;
  if (input.primaryCategoryId !== undefined) safeData.primary_category_id = input.primaryCategoryId ?? null;
  if (input.skills !== undefined) safeData.skills = input.skills;
  if (input.languages !== undefined) safeData.languages = input.languages;
  if (input.city !== undefined) safeData.city = input.city ?? null;
  if (input.state !== undefined) safeData.state = input.state ?? null;
  if (input.country !== undefined) safeData.country = input.country;
  if (input.profileImageUrl !== undefined) safeData.profile_image_url = input.profileImageUrl ?? null;
  if (input.introVideoUrl !== undefined) safeData.intro_video_url = input.introVideoUrl ?? null;
  if (input.coverImageUrl !== undefined) safeData.cover_image_url = input.coverImageUrl ?? null;
  if (input.headline !== undefined) safeData.headline = input.headline ?? null;
  if (input.websiteUrl !== undefined) safeData.website_url = input.websiteUrl ?? null;
  if (input.profileTheme !== undefined) safeData.profile_theme = input.profileTheme ?? null;

  return updateCreatorProfile(supabase, creatorProfileId, safeData);
}

/**
 * Public lookup by slug for public creator profile page.
 */
export async function getPublicCreatorProfileBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<CreatorProfileWithCategory | null> {
  return getCreatorProfileBySlug(supabase, slug);
}

/**
 * Ensures a creator profile row exists for the given profile ID (profiles.id).
 * Idempotent: safe to call on every profile fetch or update.
 */
export async function ensureCreatorProfileForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<CreatorProfile> {
  const existing = await getCreatorProfileByUserId(supabase, profileId);
  if (existing) return existing;

  // Retrieve base profile to get defaults
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (profileErr || !profile) {
    throw new Error(`Profile not found for ID: ${profileId}`);
  }

  if (profile.role !== 'creator') {
    throw new Error(`Profile role is not creator for ID: ${profileId}`);
  }

  const slug = await buildUniqueSlug(supabase, profile.full_name || profile.username || 'creator');

  return createCreatorProfile(supabase, {
    user_id: profileId,
    display_name: profile.full_name || profile.username || 'Creator',
    slug,
    bio: profile.bio ?? null,
    city: profile.city ?? null,
    state: profile.state ?? null,
    country: profile.country ?? 'India',
    profile_image_url: profile.avatar_url ?? null,
    cover_image_url: profile.cover_image_url ?? null,
    skills: [],
    languages: [],
  });
}

