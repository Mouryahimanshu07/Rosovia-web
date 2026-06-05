import { describe, it, expect, beforeAll, afterAll } from 'vitest';
declare const process: { env: { SUPABASE_API_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; }; };

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_API_URL || 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'mock-anon-key';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

describe('Database Security: creator_posts RLS & trigger policy suite', () => {
  let anonClient: any;
  let creatorClient: any;
  let adminClient: any;
  let serviceClient: any;

  let testCreatorProfileId: string;
  let testProfileId: string;
  let testPostId: string;
  let createdUserIds: string[] = [];
  let isOnline = false;

  beforeAll(async () => {
    anonClient = createClient(SUPABASE_URL, ANON_KEY);
    serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

    try {
      // Test ping
      const { error: pingError } = await serviceClient.from('profiles').select('id').limit(1);
      if (pingError && pingError.message.includes('fetch failed')) {
        throw pingError;
      }

      // 1. Create a Creator User
      const creatorEmail = `testcreator-${Date.now()}@example.com`;
      const { data: creatorAuth, error: creatorAuthErr } = await serviceClient.auth.admin.createUser({
        email: creatorEmail,
        password: 'password123',
        email_confirm: true,
      });

      if (creatorAuthErr || !creatorAuth.user) throw creatorAuthErr || new Error('Failed to create creator auth');
      createdUserIds.push(creatorAuth.user.id);

      const { data: creatorProfile, error: creatorProfErr } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('auth_user_id', creatorAuth.user.id)
        .single();

      if (creatorProfErr || !creatorProfile) throw creatorProfErr || new Error('Failed to fetch creator profile');

      testProfileId = creatorProfile.id;

      // Update role & status
      await serviceClient
        .from('profiles')
        .update({ role: 'creator', status: 'active' })
        .eq('id', creatorProfile.id);

      const { data: creatorDetails } = await serviceClient
        .from('creator_profiles')
        .insert({
          user_id: creatorProfile.id,
          display_name: 'Test Creator RLS',
          slug: `test-creator-rls-${Date.now()}`,
        })
        .select('id')
        .single();

      testCreatorProfileId = creatorDetails.id;

      // Log in Creator
      creatorClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: creatorLoginErr } = await creatorClient.auth.signInWithPassword({
        email: creatorEmail,
        password: 'password123',
      });
      if (creatorLoginErr) throw creatorLoginErr;

      // 2. Create an Admin User
      const adminEmail = `testadmin-${Date.now()}@example.com`;
      const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
        email: adminEmail,
        password: 'password123',
        email_confirm: true,
      });

      if (adminAuthErr || !adminAuth.user) throw adminAuthErr || new Error('Failed to create admin auth');
      createdUserIds.push(adminAuth.user.id);

      const { data: adminProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('auth_user_id', adminAuth.user.id)
        .single();

      await serviceClient
        .from('profiles')
        .update({ role: 'admin', status: 'active' })
        .eq('id', adminProfile.id);

      // Log in Admin
      adminClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: adminLoginErr } = await adminClient.auth.signInWithPassword({
        email: adminEmail,
        password: 'password123',
      });
      if (adminLoginErr) throw adminLoginErr;

      // Create initial pending post as Creator Client to test updates
      const { data: initialPost, error: postErr } = await creatorClient
        .from('creator_posts')
        .insert({
          creator_profile_id: testCreatorProfileId,
          caption: 'Pending post caption',
          post_type: 'image',
          visibility: 'public',
        })
        .select('id')
        .single();

      if (postErr || !initialPost) throw postErr || new Error('Failed to insert test post');
      testPostId = initialPost.id;

      isOnline = true;
    } catch (e) {
      console.warn('Supabase local server is offline or unreachable. Skipping integration tests.', e);
      isOnline = false;
    }
  });

  afterAll(async () => {
    if (isOnline && createdUserIds.length > 0) {
      for (const id of createdUserIds) {
        await serviceClient.auth.admin.deleteUser(id);
      }
    }
  });

  it('CREATOR: cannot change moderation_status from pending to approved', async () => {
    if (!isOnline) return;

    const { error } = await creatorClient
      .from('creator_posts')
      .update({ moderation_status: 'approved' })
      .eq('id', testPostId);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('allowed to update protected post fields');
  });

  it('CREATOR: cannot modify like_count/save_count/view_count/creator_profile_id/created_at', async () => {
    if (!isOnline) return;

    // Test like_count
    const { error: errLike } = await creatorClient
      .from('creator_posts')
      .update({ like_count: 99 })
      .eq('id', testPostId);
    expect(errLike?.message).toContain('allowed to update protected post fields');

    // Test save_count
    const { error: errSave } = await creatorClient
      .from('creator_posts')
      .update({ save_count: 99 })
      .eq('id', testPostId);
    expect(errSave?.message).toContain('allowed to update protected post fields');

    // Test view_count
    const { error: errView } = await creatorClient
      .from('creator_posts')
      .update({ view_count: 99 })
      .eq('id', testPostId);
    expect(errView?.message).toContain('allowed to update protected post fields');

    // Test creator_profile_id
    const { error: errCreatorProfileId } = await creatorClient
      .from('creator_posts')
      .update({ creator_profile_id: '00000000-0000-0000-0000-000000000000' })
      .eq('id', testPostId);
    expect(errCreatorProfileId?.message).toContain('allowed to update protected post fields');

    // Test created_at
    const { error: errCreatedAt } = await creatorClient
      .from('creator_posts')
      .update({ created_at: new Date().toISOString() })
      .eq('id', testPostId);
    expect(errCreatedAt?.message).toContain('allowed to update protected post fields');
  });

  it('ADMIN: can moderate post', async () => {
    if (!isOnline) return;

    const { error } = await adminClient
      .from('creator_posts')
      .update({ moderation_status: 'approved' })
      .eq('id', testPostId);

    expect(error).toBeNull();

    // Verify it changed
    const { data } = await serviceClient
      .from('creator_posts')
      .select('moderation_status')
      .eq('id', testPostId)
      .single();

    expect(data?.moderation_status).toBe('approved');
  });

  it('ANON: approved public post is visible publicly', async () => {
    if (!isOnline) return;

    const { data, error } = await anonClient
      .from('creator_posts')
      .select('id')
      .eq('id', testPostId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.id).toBe(testPostId);
  });

  it('ANON: pending/rejected/hidden post is not visible publicly', async () => {
    if (!isOnline) return;

    // Create a new post as Creator Client (starts as pending)
    const { data: newPost } = await creatorClient
      .from('creator_posts')
      .insert({
        creator_profile_id: testCreatorProfileId,
        caption: 'Another post',
        post_type: 'image',
        visibility: 'public',
      })
      .select('id')
      .single();

    // 1. Pending post is not visible
    const { data: dataPending } = await anonClient
      .from('creator_posts')
      .select('id')
      .eq('id', newPost.id);
    expect(dataPending?.length).toBe(0);

    // 2. Reject the post
    await adminClient
      .from('creator_posts')
      .update({ moderation_status: 'rejected' })
      .eq('id', newPost.id);

    const { data: dataRejected } = await anonClient
      .from('creator_posts')
      .select('id')
      .eq('id', newPost.id);
    expect(dataRejected?.length).toBe(0);

    // 3. Hide the post
    await adminClient
      .from('creator_posts')
      .update({ moderation_status: 'hidden' })
      .eq('id', newPost.id);

    const { data: dataHidden } = await anonClient
      .from('creator_posts')
      .select('id')
      .eq('id', newPost.id);
    expect(dataHidden?.length).toBe(0);
  });

  it('MEDIA: public post media visible only after post approval, pending post media excluded', async () => {
    if (!isOnline) return;

    // 1. Create media asset using service client to bypass checks
    const { data: media, error: mediaErr } = await serviceClient
      .from('media_assets')
      .insert({
        owner_id: testProfileId,
        media_type: 'image',
        storage_provider: 'cloudflare_r2',
        storage_key: `public/profiles/${testProfileId}/post-test.jpg`,
        public_url: 'http://localhost/post-test.jpg',
        size_bytes: 1000,
        mime_type: 'image/jpeg',
        is_private: false,
        status: 'approved',
      })
      .select('id')
      .single();

    expect(mediaErr).toBeNull();

    // 2. Create a pending post
    const { data: pendingPost } = await creatorClient
      .from('creator_posts')
      .insert({
        creator_profile_id: testCreatorProfileId,
        caption: 'Post with media',
        post_type: 'image',
        visibility: 'public',
      })
      .select('id')
      .single();

    // Link media to post
    const { error: linkErr } = await creatorClient
      .from('creator_post_media')
      .insert({
        post_id: pendingPost.id,
        media_asset_id: media.id,
        sort_order: 0,
      });

    expect(linkErr).toBeNull();

    // Anon should NOT be able to view the media asset because the parent post is pending
    const { data: mediaBeforeApproval } = await anonClient
      .from('media_assets')
      .select('id')
      .eq('id', media.id);

    expect(mediaBeforeApproval?.length).toBe(0);

    // 3. Admin approves the post
    await adminClient
      .from('creator_posts')
      .update({ moderation_status: 'approved' })
      .eq('id', pendingPost.id);

    // Anon should now be able to view the media asset
    const { data: mediaAfterApproval } = await anonClient
      .from('media_assets')
      .select('id')
      .eq('id', media.id);

    expect(mediaAfterApproval?.length).toBe(1);
    expect(mediaAfterApproval?.[0]?.id).toBe(media.id);

    // Clean up post media link and media asset
    await serviceClient.from('creator_post_media').delete().eq('post_id', pendingPost.id);
    await serviceClient.from('media_assets').delete().eq('id', media.id);
    await serviceClient.from('creator_posts').delete().eq('id', pendingPost.id);
  });

  it('MEDIA: verification documents remain private and not publicly approved', async () => {
    if (!isOnline) return;

    // Insert verification document as private
    const { data: doc, error: docErr } = await serviceClient
      .from('media_assets')
      .insert({
        owner_id: testProfileId,
        media_type: 'document',
        storage_provider: 'cloudflare_r2',
        storage_key: `private/users/${testProfileId}/id.pdf`,
        size_bytes: 5000,
        mime_type: 'application/pdf',
        is_private: true,
        status: 'uploaded', // verification document usage is private, status uploaded
      })
      .select('*')
      .single();

    expect(docErr).toBeNull();
    expect(doc.is_private).toBe(true);
    expect(doc.status).toBe('uploaded'); // should not be approved

    // Anon must not be able to read this private media asset
    const { data: dataDoc } = await anonClient
      .from('media_assets')
      .select('id')
      .eq('id', doc.id);

    expect(dataDoc?.length).toBe(0);

    // Clean up
    await serviceClient.from('media_assets').delete().eq('id', doc.id);
  });

  it('SHOWCASE: approved listing showcase appears after post approval, pending showcase post is not visible', async () => {
    if (!isOnline) return;

    // 1. Create a listing using service client
    const { data: listing, error: listingErr } = await serviceClient
      .from('listings')
      .insert({
        creator_id: testCreatorProfileId,
        title: 'Test Listing for Showcase',
        slug: `test-listing-showcase-${Date.now()}`,
        status: 'approved',
        price: 500,
        currency: 'INR',
      })
      .select('id')
      .single();

    expect(listingErr).toBeNull();

    // 2. Create a pending showcase post
    const { data: pendingPost, error: postErr } = await creatorClient
      .from('creator_posts')
      .insert({
        creator_profile_id: testCreatorProfileId,
        caption: 'Showcasing our awesome listing!',
        post_type: 'listing_showcase',
        listing_id: listing.id,
        visibility: 'public',
      })
      .select('id')
      .single();

    expect(postErr).toBeNull();

    // Anon should not be able to view the post yet because it is pending
    const { data: beforeApproval } = await anonClient
      .from('creator_posts')
      .select('id, listing_id')
      .eq('id', pendingPost.id);

    expect(beforeApproval?.length).toBe(0);

    // 3. Admin approves the post
    await adminClient
      .from('creator_posts')
      .update({ moderation_status: 'approved' })
      .eq('id', pendingPost.id);

    // Anon should now be able to view the post and see the showcased listing
    const { data: afterApproval } = await anonClient
      .from('creator_posts')
      .select('id, listing_id')
      .eq('id', pendingPost.id);

    expect(afterApproval?.length).toBe(1);
    expect(afterApproval?.[0]?.listing_id).toBe(listing.id);

    // Clean up
    await serviceClient.from('creator_posts').delete().eq('id', pendingPost.id);
    await serviceClient.from('listings').delete().eq('id', listing.id);
  });
});
