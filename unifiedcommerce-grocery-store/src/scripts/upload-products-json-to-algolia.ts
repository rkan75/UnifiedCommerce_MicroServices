/**
 * Upload data/products-for-algolia.json to the Algolia "products" index.
 * Use this when you have the JSON file already and want to push it without running the full Medusa export.
 *
 * Run from backend directory:
 *   ALGOLIA_APP_ID=xxx ALGOLIA_ADMIN_API_KEY=yyy npx ts-node src/scripts/upload-products-json-to-algolia.ts
 *
 * Optional: ALGOLIA_INDEX_NAME=products (default), JSON_FILE=data/products-for-algolia.json
 */
import * as fs from "fs";
import * as path from "path";

const DEFAULT_INDEX = "products";
const DEFAULT_JSON = path.join(process.cwd(), "data", "products-for-algolia.json");
const BATCH_SIZE = 1000;

async function main() {
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY;
  const indexName = process.env.ALGOLIA_INDEX_NAME || DEFAULT_INDEX;
  const jsonPath = process.env.JSON_FILE || DEFAULT_JSON;

  if (!appId || !apiKey) {
    console.error("Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY (Admin API key from Algolia Dashboard).");
    process.exit(1);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    console.error("Run the export first: npx medusa exec ./src/scripts/algolia-export-products.ts");
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  let records: Record<string, unknown>[];
  try {
    records = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", (e as Error).message);
    process.exit(1);
  }

  if (!Array.isArray(records)) {
    console.error("JSON must be an array of objects with objectID.");
    process.exit(1);
  }

  const baseUrl = `https://${appId}-dsn.algolia.net`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Algolia-API-Key": apiKey,
    "X-Algolia-Application-Id": appId,
  };

  console.log(`Uploading ${records.length} records to index "${indexName}"...`);

  // Clear existing records
  const clearRes = await fetch(`${baseUrl}/1/indexes/${indexName}/clear`, {
    method: "POST",
    headers,
  });
  if (!clearRes.ok) {
    const err = await clearRes.text();
    console.error("Clear failed:", clearRes.status, err);
    process.exit(1);
  }

  // Batch upload
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const requests = chunk.map((obj) => ({
      action: "addObject" as const,
      body: obj,
    }));
    const batchRes = await fetch(`${baseUrl}/1/indexes/${indexName}/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ requests }),
    });
    if (!batchRes.ok) {
      const err = await batchRes.text();
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchRes.status, err);
      process.exit(1);
    }
    console.log(`  Uploaded ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
  }

  console.log("Done. Algolia index", indexName, "updated with", records.length, "records.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
