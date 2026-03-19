#!/usr/bin/env node
/**
 * Apply Cloud SQL Proxy SSL fix to @medusajs/utils (force ssl: false for localhost).
 * Run after npm install if you get KnexTimeoutError when connecting to 127.0.0.1:5433.
 * Usage: node scripts/apply-cloudsql-ssl-fix.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  process.cwd(),
  'node_modules/@medusajs/utils/dist/modules-sdk/create-pg-connection.js'
);

if (!fs.existsSync(file)) {
  console.error('File not found:', file);
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

const old = `    const ssl = options.driverOptions?.ssl ??
        options.driverOptions?.connection?.ssl ??
        false;`;

const newCode = `    // Force no SSL for localhost/127.0.0.1 (e.g. Cloud SQL Proxy) so connection does not hang
    const isLocal = clientUrl && (clientUrl.includes("127.0.0.1") || clientUrl.includes("localhost"));
    const ssl = isLocal ? false : (options.driverOptions?.ssl ??
        options.driverOptions?.connection?.ssl ??
        false);`;

if (content.includes('const isLocal = clientUrl &&')) {
  console.log('Cloud SQL SSL fix already applied.');
  process.exit(0);
}

if (!content.includes(old)) {
  console.error('Could not find expected code block to patch. Package version may have changed.');
  process.exit(1);
}

content = content.replace(old, newCode);
fs.writeFileSync(file, content);
console.log('Applied Cloud SQL Proxy SSL fix to @medusajs/utils.');
