#!/usr/bin/env node
/**
 * Test actual PostgreSQL connection with same URL and options as Medusa.
 * Run from backend dir: node scripts/test-db-connect.js
 * If this works but Medusa still times out, the app is not using our config.
 */
const fs = require('fs');
const path = require('path');

// Load .env
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
      return;
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

const isLocal = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
const sep = dbUrl.includes('?') ? '&' : '?';
const urlWithParams = isLocal ? dbUrl + sep + 'sslmode=disable&connect_timeout=30' : dbUrl;

const { Client } = require('pg');

const client = new Client({
  connectionString: urlWithParams,
  connectionTimeoutMillis: 30000,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

console.log('Connecting with:', urlWithParams.replace(/:[^:@]+@/, ':****@').substring(0, 70) + '...');
console.log('ssl option:', isLocal ? 'false' : 'rejectUnauthorized: false');

client.connect()
  .then(() => client.query('SELECT 1 as ok'))
  .then((res) => {
    console.log('✅ PostgreSQL connection OK:', res.rows[0]);
    return client.end();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Connection failed:', err.message);
    if (err.code) console.error('   code:', err.code);
    if (err.code === '28P01') {
      console.error('');
      console.error('Password authentication failed. Fix:');
      console.error('  1. In GCP Console → SQL → your instance → Users: ensure user "medusa_app" exists.');
      console.error('  2. Set the user password to match DATABASE_URL in .env (or set .env to match Cloud SQL).');
      console.error('  3. If you used deploy/01-create-database.sql, the default password is UnifiedCommerce@1');
      console.error('     → Use DATABASE_URL=postgresql://medusa_app:UnifiedCommerce@1@127.0.0.1:5433/medusa_grocery_store in .env');
      console.error('     or change the medusa_app password in Cloud SQL to match your current .env.');
    }
    process.exit(1);
  });
