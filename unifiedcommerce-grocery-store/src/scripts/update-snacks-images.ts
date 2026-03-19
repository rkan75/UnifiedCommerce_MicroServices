/**
 * One-off script: updates existing Snacks category product images in the DB
 * to use the curated image URLs from snacks-images.ts (by product title).
 *
 * Run: npx medusa exec ./src/scripts/update-snacks-images.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { batchVariantImagesWorkflow } from "@medusajs/medusa/core-flows";
import { getSnacksImageUrl } from "./snacks-images";

export default async function updateSnacksImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Resolving Snacks category...");
  const [snacksCategory] = await productModuleService.listProductCategories(
    { handle: "snacks" },
    { take: 1 }
  );
  if (!snacksCategory) {
    logger.warn("Snacks category not found. Exiting.");
    return;
  }

  logger.info("Listing products in Snacks category...");
  const snacksProducts = await productModuleService.listProducts(
    { categories: { id: [snacksCategory.id] } },
    { relations: ["images", "variants"], take: 500 }
  );

  if (snacksProducts.length === 0) {
    logger.info("No products found in Snacks category.");
    return;
  }

  logger.info(`Updating images for ${snacksProducts.length} Snacks products.`);
  let updated = 0;
  let failed = 0;

  for (const product of snacksProducts) {
    const newUrl = getSnacksImageUrl(product.title);
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
