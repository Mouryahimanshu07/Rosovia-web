const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.ggcgsiwsfsdojvygjyoi:Himanshu%232857@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase Postgres!');

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '045_universal_user_profiles_and_follows.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log('Successfully applied migration 045!');
  } catch (err) {
    console.error('Failed to apply migration 045:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
