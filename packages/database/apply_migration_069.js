const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase Postgres!');

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '069_creator_architecture_fixes.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log('Successfully applied migration 069!');
  } catch (err) {
    console.error('Failed to apply migration 069:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
