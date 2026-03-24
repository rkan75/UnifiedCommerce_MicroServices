/**
 * Export product title, SKU, and all image URLs to an Excel file.
 * One row per variant; columns: Product, SKU, Thumbnail URL, Image URL 1, Image URL 2, ...
 *
 * Run from backend directory:
 *   npx medusa exec ./src/scripts/export-products-excel.ts
 *
 * Output: data/products-images-export.xlsx
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore - xlsx has no types in @types
import * as XLSX from "xlsx";

function getImageUrls(product: any): string[] {
  const urls: string[] = [];
  const thumb = product.thumbnail;
  if (thumb && typeof thumb === "string") urls.push(thumb);
  const images = product.images ?? [];
  for (const img of images) {
    const url = typeof img === "string" ? img : img?.url;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

export default async function exportProductsExcel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Fetching all products (with variants, images)...");

  let products: any[];
  try {
    products = await productModuleService.listProducts(
      {},
      { take: 10000, relations: ["variants", "images"] }
    );
  } catch (e) {
    products = await productModuleService.listProducts(
      {},
      { take: 10000, relations: ["variants", "images"] }
    );
  }

  if (products.length === 0) {
    logger.warn("No products found. Nothing to export.");
    return;
  }

  // Build flat rows: one per variant, with product title, SKU, and all image URL columns
  const maxImages = Math.max(
    ...products.map((p) => getImageUrls(p).length),
    1
  );
  const imageColumns = Array.from(
    { length: maxImages },
    (_, i) => (i === 0 ? "Thumbnail URL" : `Image URL ${i}`)
  );
  const headers = ["Product", "SKU", ...imageColumns];

  const rows: Record<string, string>[] = [];
  for (const product of products) {
    const title = product.title ?? "";
    const imageUrls = getImageUrls(product);
    const variants = product.variants ?? [];
    if (variants.length === 0) {
      const row: Record<string, string> = { Product: title, SKU: "" };
      imageColumns.forEach((col, i) => (row[col] = imageUrls[i] ?? ""));
      rows.push(row);
    } else {
      for (const v of variants) {
        const row: Record<string, string> = {
          Product: title,
          SKU: v.sku ?? "",
        };
        imageColumns.forEach((col, i) => (row[col] = imageUrls[i] ?? ""));
        rows.push(row);
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const outPath = path.join(dataDir, "products-images-export.xlsx");
  XLSX.writeFile(wb, outPath, { bookType: "xlsx" });

  logger.info(`Exported ${rows.length} rows to ${outPath}`);
}
