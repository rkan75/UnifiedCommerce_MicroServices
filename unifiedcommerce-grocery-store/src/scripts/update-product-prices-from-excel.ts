/**
 * Updates product variant prices in the database from product_price_list.xlsx.
 * Matches rows by Product (column A); uses Price or Price_Numeric for the amount.
 *
 * Run from backend directory (with DATABASE_URL set for Cloud SQL if needed):
 *   npx medusa exec ./src/scripts/update-product-prices-from-excel.ts
 *
 * Optional: EXCEL_FILE=data/other.xlsx (default: data/product_price_list.xlsx).
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import * as XLSX from "xlsx";

function parsePrice(priceStr: string | number): number | null {
  if (priceStr === undefined || priceStr === null) return null;
  if (typeof priceStr === "number") {
    if (isNaN(priceStr) || priceStr <= 0) return null;
    return Math.round(priceStr * 100); // Medusa stores amount in cents
  }
  if (String(priceStr).trim() === "") return null;
  const cleaned = String(priceStr).replace(/[$,\s]/g, "").trim();
  const price = parseFloat(cleaned);
  if (isNaN(price) || price <= 0) return null;
  return Math.round(price * 100); // Medusa stores amount in cents
}

const DEFAULT_EXCEL = "product_price_list.xlsx";
const DATA_DIR = path.join(process.cwd(), "data");

export default async function updateProductPricesFromExcel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (msg: string) => void;
    warn: (msg: string) => void;
  };
  const productModuleService = container.resolve(Modules.PRODUCT);
  const regionModuleService = container.resolve(Modules.REGION);

  const excelFile = process.env.EXCEL_FILE || path.join(DATA_DIR, DEFAULT_EXCEL);
  if (!fs.existsSync(excelFile)) {
    logger.warn(`File not found: ${excelFile}. Place product_price_list.xlsx in data/ or set EXCEL_FILE.`);
    return;
  }

  const wb = XLSX.readFile(excelFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });
  if (rows.length === 0) {
    logger.warn("No rows in Excel.");
    return;
  }

  const priceByTitle = new Map<string, number>();
  for (const row of rows) {
    const title = String(row["Product"] ?? "").trim();
    if (!title) continue;
    if (priceByTitle.has(title)) continue;
    const priceVal = row["Price_Numeric"] ?? row["Price"];
    const priceCents = parsePrice(priceVal);
    if (priceCents !== null) {
      priceByTitle.set(title, priceCents);
    }
  }

  logger.info(`Loaded ${priceByTitle.size} products with prices from ${excelFile}.`);

  const regions = await regionModuleService.listRegions({}, { take: 10 });
  const defaultRegion = regions[0];
  if (!defaultRegion) {
    logger.warn("No region found. Cannot set currency for prices.");
    return;
  }
  const currencyCode = (defaultRegion.currency_code ?? "usd").toLowerCase();

  const allProducts = await productModuleService.listProducts(
    {},
    { take: 10000, relations: ["variants"] }
  );
  if (allProducts.length === 0) {
    logger.warn("No products in database.");
    return;
  }

  const variantPrices: { variant_id: string; product_id: string; prices: { amount: number; currency_code: string }[] }[] = [];
  let matched = 0;
  let skipped = 0;

  for (const product of allProducts) {
    const title = (product.title ?? "").trim();
    const priceCents = title ? priceByTitle.get(title) : undefined;
    if (priceCents === undefined) {
      skipped++;
      continue;
    }
    const variants = (product.variants ?? []) as { id: string }[];
    if (variants.length === 0) {
      skipped++;
      continue;
    }
    matched++;
    for (const variant of variants) {
      variantPrices.push({
        variant_id: variant.id,
        product_id: product.id,
        prices: [{ amount: priceCents, currency_code: currencyCode }],
      });
    }
  }

  if (variantPrices.length === 0) {
    logger.info("No product titles from Excel matched database products. Done.");
    return;
  }

  logger.info(`Updating prices for ${matched} products (${variantPrices.length} variants). Currency: ${currencyCode}.`);

  try {
    // Pass all variant IDs as previousVariantIds so the workflow updates existing prices
    // instead of creating new links (which would error: "Cannot create multiple links").
    await upsertVariantPricesWorkflow(container).run({
      input: {
        variantPrices,
        previousVariantIds: variantPrices.map((v) => v.variant_id),
      },
    });
    logger.info(`Done. Updated prices for ${variantPrices.length} variants. Skipped (no match): ${skipped}.`);
  } catch (err) {
    logger.warn(`Price update failed: ${err}`);
    throw err;
  }
}
