/**
 * Reads products-images-export_1.xlsx, fills image URL columns based on product name (column A).
 * Uses: (1) curated Produce/Snacks mappings, (2) Unsplash API search for other products.
 * Output: data/products-images-export-filled.xlsx
 *
 * Run from backend directory:
 *   npx ts-node src/scripts/fill-product-images-from-excel.ts
 * Or with Unsplash API (for non-Produce/Snacks): set UNSPLASH_ACCESS_KEY
 *
 * Note: Kroger/Target scraping is not used (ToS); images are from Unsplash (grocery/food style).
 */
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import * as XLSX from "xlsx";
import { getProduceImageUrl } from "./produce-images";
import { getSnacksImageUrl } from "./snacks-images";

const INPUT_FILE = "products-images-export_1.xlsx";
const OUTPUT_FILE = "products-images-export-filled.xlsx";
const DATA_DIR = path.join(process.cwd(), "data");

async function unsplashSearch(productName: string, accessKey: string): Promise<string[]> {
  const query = encodeURIComponent(productName.trim());
  const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=3&client_id=${accessKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { urls?: { regular?: string } }[] };
    const results = data.results ?? [];
    return results
      .map((r) => r.urls?.regular)
      .filter((u): u is string => !!u)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function getImageUrlsFromMappings(productName: string): string[] {
  const produce = getProduceImageUrl(productName);
  const snacks = getSnacksImageUrl(productName);
  const produceFallbackId = "1458571037713-913d8b481dc6";
  const snacksDefaultSeed = "snacks-default";
  const isProduceMatch = produce && !produce.includes(produceFallbackId);
  const isSnacksMatch = snacks && !snacks.includes(snacksDefaultSeed);
  if (isProduceMatch) return [produce];
  if (isSnacksMatch) return [snacks];
  if (produce) return [produce];
  if (snacks) return [snacks];
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const inputPath = path.join(DATA_DIR, INPUT_FILE);
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}. Run export first or place ${INPUT_FILE} in data/`);
    process.exit(1);
  }

  const wb = XLSX.readFile(inputPath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  if (rows.length === 0) {
    console.error("No rows in sheet.");
    process.exit(1);
  }

  const headers = Object.keys(rows[0]);
  const productCol = "Product";
  const imageCols = headers.filter(
    (h) => h === "Thumbnail URL" || /^Image URL \d+$/.test(h)
  );
  if (!headers.includes(productCol)) {
    console.error("Column 'Product' not found.");
    process.exit(1);
  }
  if (imageCols.length === 0) {
    console.error("No image URL columns found (Thumbnail URL, Image URL 1, ...).");
    process.exit(1);
  }

  const cache = new Map<string, string[]>();
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

  const getUrls = async (productName: string): Promise<string[]> => {
    const key = (productName || "").trim();
    if (!key) return [];
    if (cache.has(key)) return cache.get(key)!;
    let urls = getImageUrlsFromMappings(key);
    if (urls.length === 0 && unsplashKey) {
      urls = await unsplashSearch(key, unsplashKey);
      await sleep(400);
    }
    cache.set(key, urls);
    return urls;
  };

  const uniqueProducts = [...new Set(rows.map((r) => (r[productCol] ?? "").trim()).filter(Boolean))];
  console.log(`Filling images for ${uniqueProducts.length} unique products (${rows.length} rows)...`);
  if (!unsplashKey) {
    console.log("Tip: Set UNSPLASH_ACCESS_KEY for products not in Produce/Snacks mappings.");
  }

  for (const name of uniqueProducts) {
    await getUrls(name);
  }

  for (const row of rows) {
    const name = (row[productCol] ?? "").trim();
    const urls = cache.get(name) ?? [];
    imageCols.forEach((col, i) => {
      row[col] = urls[i] ?? "";
    });
  }

  const outPath = path.join(DATA_DIR, OUTPUT_FILE);
  const newWb = XLSX.utils.book_new();
  const newWs = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.book_append_sheet(newWb, newWs, "Products");
  XLSX.writeFile(newWb, outPath, { bookType: "xlsx" });
  console.log(`Written ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
