const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase Postgres!');

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '068_creator_system_rls_fixes.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log('Successfully applied migration 068!');
  } catch (err) {
    console.error('Failed to apply migration 068:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

