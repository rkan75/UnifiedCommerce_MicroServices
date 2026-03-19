/**
 * One-off script: updates existing Produce category product images in the DB
 * to use the curated image URLs from produce-images.ts (by product title).
 *
 * Run: npx medusa exec ./src/scripts/update-produce-images.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { batchVariantImagesWorkflow } from "@medusajs/medusa/core-flows";
import { getProduceImageUrl } from "./produce-images";

export default async function updateProduceImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Resolving Produce category...");
  const [produceCategory] = await productModuleService.listProductCategories(
    { handle: "produce" },
    { take: 1 }
  );
  if (!produceCategory) {
    logger.warn("Produce category not found. Exiting.");
    return;
  }

  logger.info("Listing products in Produce category...");
  const produceProducts = await productModuleService.listProducts(
    { categories: { id: [produceCategory.id] } },
    { relations: ["images", "variants"], take: 500 }
  );

  if (produceProducts.length === 0) {
    logger.info("No products found in Produce category.");
    return;
  }

  logger.info(`Updating images for ${produceProducts.length} Produce products.`);
  let updated = 0;
  let failed = 0;

  for (const product of produceProducts) {
    const newUrl = getProduceImageUrl(product.title);
    const hadExistingImages = (product.images?.length ?? 0) > 0;
    const imageUpdates = hadExistingImages
      ? product.images!.map((img: { id: string }) => ({ id: img.id, url: newUrl }))
      : [{ url: newUrl }];

    try {
      await productModuleService.updateProducts(product.id, {
        thumbnail: newUrl,
        images: imageUpdates,
      });
      updated++;

      if (!hadExistingImages) {
        const variantIds = product.variants?.map((v: { id: string }) => v.id).filter(Boolean) ?? [];
        if (variantIds.length > 0) {
          const refreshed = await productModuleService.retrieveProduct(product.id, { relations: ["images"] });
          const firstImageId = refreshed.images?.[0]?.id;
          if (firstImageId) {
            for (const variantId of variantIds) {
              await batchVariantImagesWorkflow(container).run({
                input: { variant_id: variantId, add: [firstImageId] },
              });
            }
          }
        }
      }
    } catch (err) {
      failed++;
      logger.warn(`Failed to update product '${product.title}' (${product.id}): ${err}`);
    }
  }

  logger.info(`Done. Updated: ${updated}, Failed: ${failed}.`);
}
