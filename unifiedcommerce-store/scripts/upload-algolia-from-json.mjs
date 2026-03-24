#!/usr/bin/env node
/**
 * Upload products-for-algolia.json to Algolia (replace entire index).
 *
 * Use this when you have already exported JSON and want to upload without
 * running the full Medusa backend.
 *
 * Prerequisites:
 *   - data/products-for-algolia.json exists (from algolia-export-products.ts)
 *   - .env has ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY
 *
 * Run from backend directory (demo-grocery-store):
 *   node scripts/upload-algolia-from-json.mjs
 *
 * Or with env vars inline:
 *   ALGOLIA_APP_ID=xxx ALGOLIA_ADMIN_API_KEY=yyy node scripts/upload-algolia-from-json.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import algoliasearch from "algoliasearch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const jsonPath = path.join(rootDir, "data", "products-for-algolia.json");
const indexName = process.env.ALGOLIA_INDEX_NAME || "products";

// Load .env from backend root if present
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const appId = process.env.ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_API_KEY;

if (!appId || !adminKey) {
  console.error("Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY in .env");
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error("File not found:", jsonPath);
  console.error("Run first: npx medusa exec ./src/scripts/algolia-export-products.ts");
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, "utf-8");
let documents;
try {
  documents = JSON.parse(raw);
} catch (e) {
  console.error("Invalid JSON in", jsonPath, e.message);
  process.exit(1);
}

if (!Array.isArray(documents)) {
  console.error("JSON must be an array of product records.");
  process.exit(1);
}

const client = algoliasearch(appId, adminKey);

async function main() {
  console.log("Uploading", documents.length, "records to Algolia index:", indexName);
  await client.initIndex(indexName).replaceAllObjects(documents);
  console.log("Done. Index", indexName, "updated.");
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
