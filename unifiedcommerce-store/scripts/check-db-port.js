#!/usr/bin/env node
/**
 * Check if the database host:port from .env DATABASE_URL is reachable (e.g. Cloud SQL Proxy).
 * Run from backend directory: node scripts/check-db-port.js
 * Exit 0 if reachable, 1 otherwise.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) {
      const val = m[1].trim().replace(/^["']|["']$/g, '');
      process.env.DATABASE_URL = val;
      return;
    }
  }
}

function parseHostPort(dbUrl) {
  if (!dbUrl) return null;
  // postgresql://user:pass@host:port/db -> host, port
  const match = dbUrl.match(/@([^@/]+):(\d+)(?:\/|$)/);
  if (match) return { host: match[1], port: parseInt(match[2], 10) };
  return null;
}

function checkPort(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      try { socket.destroy(); } catch (_) {}
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

loadEnv();
const dbUrl = process.env.DATABASE_URL;
const hp = parseHostPort(dbUrl);

if (!hp) {
  console.error('Could not parse host:port from DATABASE_URL');
  process.exit(1);
}

checkPort(hp.host, hp.port).then((ok) => {
  if (ok) {
    console.log(`✅ Database reachable at ${hp.host}:${hp.port}`);
    process.exit(0);
  } else {
    console.error(`❌ Cannot connect to ${hp.host}:${hp.port}`);
    if (hp.host === '127.0.0.1' || hp.host === 'localhost') {
      console.error('');
      console.error('Start Cloud SQL Proxy first in another terminal, e.g.:');
      console.error('  cloud_sql_proxy -instances=YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE=tcp:' + hp.port);
      console.error('');
      console.error('Then run this script again or start the backend.');
    }
    process.exit(1);
  }
});
