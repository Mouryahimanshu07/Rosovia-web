const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ggcgsiwsfsdojvygjyoi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnY2dzaXdzZnNkb2p2eWdqeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTEyOTQsImV4cCI6MjA5MzIyNzI5NH0.OyAHTPsZatK6Rx2CsoXsh3KrXCKEMOcQIu0ftgjm2XA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log('Querying public work feed posts...');
    let query = supabase
      .from('creator_posts')
      .select(`
        *,
        creator_profiles!inner (
          id,
          display_name,
          slug,
          profile_image_url,
          is_verified,
          verification_level,
          user_id,
          deleted_at,
          profiles!inner ( status, deleted_at )
        ),
        creator_post_media (
          id,
          post_id,
          media_asset_id,
          sort_order,
          media_assets ( id, public_url, mime_type, media_type, thumbnail_url )
        )
      `)
      .eq('visibility', 'public')
      .eq('moderation_status', 'approved')
      .is('deleted_at', null)
      .is('creator_profiles.deleted_at', null)
      .eq('creator_profiles.profiles.status', 'active')
      .is('creator_profiles.profiles.deleted_at', null)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('Work feed error:', error);
    } else {
      console.log('Work feed results count:', data.length);
    }
  } catch (error) {
    console.error('Error during query:', error);
  }
}

run();
