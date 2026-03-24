/**
 * Uploads all images from products-images-scraped.xlsx to the Cloud SQL database.
 * Updates: product (thumbnail + images) and product variant (variant images) tables only.
 * Price columns in the Excel are ignored.
 *
 * Reads: Product (column A), Thumbnail URL, Image URL 1–5.
 * Matches rows to products by title and updates Medusa product images and variant images.
 *
 * Run from backend directory (with DATABASE_URL set for Cloud SQL):
 *   npx medusa exec ./src/scripts/update-product-images-from-excel.ts
 *
 * Optional: EXCEL_FILE=data/other.xlsx (default: data/products-images-scraped.xlsx).
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { batchVariantImagesWorkflow } from "@medusajs/medusa/core-flows";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import * as XLSX from "xlsx";

const DEFAULT_EXCEL = "products-images-scraped.xlsx";
const DATA_DIR = path.join(process.cwd(), "data");

function collectImageUrls(row: Record<string, string>): string[] {
  const urls: string[] = [];
  const thumb = (row["Thumbnail URL"] ?? "").trim();
  if (thumb) urls.push(thumb);
  for (let i = 1; i <= 5; i++) {
    const v = (row[`Image URL ${i}`] ?? "").trim();
    if (v && !urls.includes(v)) urls.push(v);
  }
  return urls;
}

export default async function updateProductImagesFromExcel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (msg: string) => void;
    warn: (msg: string) => void;
  };
  const productModuleService = container.resolve(Modules.PRODUCT);

  const excelFile = process.env.EXCEL_FILE || path.join(DATA_DIR, DEFAULT_EXCEL);
  if (!fs.existsSync(excelFile)) {
    logger.warn(`File not found: ${excelFile}. Place products-images-scraped.xlsx in data/ or set EXCEL_FILE.`);
    return;
  }

  const wb = XLSX.readFile(excelFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  if (rows.length === 0) {
    logger.warn("No rows in Excel.");
    return;
  }

  const productData = new Map<string, string[]>();
  for (const row of rows) {
    const title = (row["Product"] ?? "").trim();
    if (!title) continue;
    if (productData.has(title)) continue;
    const urls = collectImageUrls(row);
    productData.set(title, urls);
  }

  const productsWithImages = Array.from(productData.values()).filter((urls) => urls.length > 0).length;
  logger.info(`Loaded ${productData.size} products from ${excelFile}. ${productsWithImages} with image URLs.`);

  const allProducts = await productModuleService.listProducts(
    {},
    { take: 10000, relations: ["images", "variants"] }
  );
  if (allProducts.length === 0) {
    logger.warn("No products in database.");
    return;
  }

  let updatedImages = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of allProducts) {
    const title = (product.title ?? "").trim();
    const urls = title ? productData.get(title) : undefined;

    if (!urls || urls.length === 0) {
      skipped++;
      continue;
    }

    const mainUrl = urls[0];
    const existingImages = (product.images ?? []) as { id: string; url?: string }[];

    const imageUpdates: Array<{ id?: string; url: string }> = [];
    const maxImages = Math.min(Math.max(existingImages.length, urls.length), 5);

    for (let i = 0; i < maxImages; i++) {
      if (i < urls.length) {
        if (i < existingImages.length) {
          imageUpdates.push({ id: existingImages[i].id, url: urls[i] });
        } else {
          imageUpdates.push({ url: urls[i] });
        }
      } else if (i < existingImages.length) {
        imageUpdates.push({
          id: existingImages[i].id,
          url: urls[urls.length - 1] || mainUrl,
        });
      }
    }

    try {
      await productModuleService.updateProducts(product.id, {
        thumbnail: mainUrl,
        images: imageUpdates,
      });
      updatedImages++;

      const variantIds = (product.variants ?? []).map((v: { id: string }) => v.id).filter(Boolean);
      if (variantIds.length > 0) {
        const refreshed = await productModuleService.retrieveProduct(product.id, { relations: ["images"] });
        const firstImageId = (refreshed.images as { id: string }[])?.[0]?.id;
        if (firstImageId) {
          for (const variantId of variantIds) {
            await batchVariantImagesWorkflow(container).run({
              input: { variant_id: variantId, add: [firstImageId] },
            });
          }
        }
      }
    } catch (err) {
      failed++;
      logger.warn(`Failed to update '${title}' (${product.id}): ${err}`);
    }
  }

  logger.info(`Done. Updated images: ${updatedImages}, Skipped (no images in Excel): ${skipped}, Failed: ${failed}.`);
}
