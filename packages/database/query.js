const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ggcgsiwsfsdojvygjyoi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnY2dzaXdzZnNkb2p2eWdqeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTEyOTQsImV4cCI6MjA5MzIyNzI5NH0.OyAHTPsZatK6Rx2CsoXsh3KrXCKEMOcQIu0ftgjm2XA';

// Using anon key to mimic browser/public client with RLS
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PAGE_SIZE = 12;

async function run() {
  try {
    console.log('Testing with ANON KEY (RLS enabled)...');
    
    console.log('Querying categories with anon key...');
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*');
    if (catError) console.error('Categories error:', catError);
    else console.log('Categories count:', categories.length);

    console.log('Querying creator_profiles with anon key...');
    const { data: creatorsAll, error: cError } = await supabase
      .from('creator_profiles')
      .select('*');
    if (cError) console.error('Creator profiles error:', cError);
    else console.log('Creator profiles count:', creatorsAll.length, creatorsAll);

    console.log('Querying profiles (joined or direct) with anon key...');
    const { data: profilesAll, error: pError } = await supabase
      .from('profiles')
      .select('*');
    if (pError) console.error('Profiles error:', pError);
    else console.log('Profiles count:', profilesAll.length, profilesAll);

    console.log('Running searchPublicCreators with anon key...');
    const page = 1;
    const offset = (page - 1) * PAGE_SIZE;
    const fetchLimit = PAGE_SIZE + 1;

    let dataQuery = supabase
      .from('creator_profiles')
      .select('*, categories(name, slug), profiles!inner(status, deleted_at)')
      .is('deleted_at', null)
      .eq('profiles.status', 'active')
      .is('profiles.deleted_at', null);

    dataQuery = dataQuery.range(offset, offset + fetchLimit - 1);

    const { data, error } = await dataQuery;
    if (error) console.error('Search error:', error);
    else console.log('Search results with anon key:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error during query:', error);
  }
}

run();
