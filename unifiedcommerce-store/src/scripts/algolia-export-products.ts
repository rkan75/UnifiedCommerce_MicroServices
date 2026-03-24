/**
 * Export product data to JSON in Algolia index shape and optionally upload to Algolia.
 *
 * 1. Extracts all products from Medusa (with variants, images, options).
 * 2. Transforms them to the same shape as the medusa-plugin-algolia transformer.
 * 3. Writes to data/products-for-algolia.json.
 * 4. If algoliaService is configured, uploads to the "products" index.
 *
 * Run from backend directory:
 *   npx medusa exec ./src/scripts/algolia-export-products.ts
 *
 * Prerequisites: .env has ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY for upload.
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import * as fs from "fs";
import * as path from "path";
import { slimAlgoliaRecord } from "../lib/algolia/slim-for-algolia";

// Same shape as the transformer in medusa-config.ts (products index); slimmed for Algolia 10KB/record limit.
function transformProductForAlgolia(product: any): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    objectID: product.id,
    id: product.id,
    title: product.title ?? "",
    description: product.description ?? "",
    handle: product.handle ?? "",
    thumbnail: product.thumbnail ?? null,
    variants: (product.variants ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
    })),
    variant_sku: (product.variants ?? [])
      .map((v: any) => v.sku)
      .filter(Boolean)
      .join(" "),
    options: (product.options ?? []).map((o: any) => o.title).join(" ") || undefined,
    collection_title: product.collection?.title ?? undefined,
    collection_handle: product.collection?.handle ?? undefined,
    images: (product.images ?? []).map((img: any) => (typeof img === "string" ? img : img.url)).filter(Boolean),
    metadata: product.metadata ?? undefined,
  };
  return slimAlgoliaRecord(doc);
}

export default async function algoliaExportProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Fetching all products (with variants, images, options)...");

  let products: any[];
  try {
    products = await productModuleService.listProducts(
      {},
      { take: 10000, relations: ["variants", "images", "options", "collection"] }
    );
  } catch (e) {
    products = await productModuleService.listProducts(
      {},
      { take: 10000, relations: ["variants", "images", "options"] }
    );
  }

  if (products.length === 0) {
    logger.warn("No products found. Nothing to export.");
    return;
  }

  // Use products as-is; collection may be undefined unless your Medusa version exposes it via relations
  const productsWithCollection = products as any[];

  const documents = productsWithCollection.map(transformProductForAlgolia);

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const outPath = path.join(dataDir, "products-for-algolia.json");
  fs.writeFileSync(outPath, JSON.stringify(documents, null, 2), "utf-8");
  logger.info(`Exported ${documents.length} products to ${outPath}`);

  let algoliaService: any;
  try {
    algoliaService = container.resolve("algoliaService");
  } catch {
    algoliaService = null;
  }

  if (algoliaService && process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_API_KEY) {
    logger.info("Uploading to Algolia index 'products'...");
    try {
      // Plugin runs its transformer on the product objects; pass raw products
      await algoliaService.replaceDocuments("products", productsWithCollection, "products");
      logger.info("Algolia index 'products' updated successfully.");
    } catch (err) {
      logger.error("Algolia upload failed: " + (err as Error).message);
      throw err;
    }
  } else {
    logger.info(
      "Skipping upload (algoliaService not configured or missing ALGOLIA_APP_ID/ALGOLIA_ADMIN_API_KEY). Use the upload script to send the JSON to Algolia."
    );
  }
}
