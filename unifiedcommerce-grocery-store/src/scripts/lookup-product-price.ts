/**
 * One-off: Look up a product by title and print its variant price(s).
 * Usage: PRODUCT_TITLE="Swiss Chard" npx medusa exec ./src/scripts/lookup-product-price.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export default async function lookupProductPrice({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (msg: string) => void;
    warn: (msg: string) => void;
  };
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const title = (process.env.PRODUCT_TITLE ?? "Swiss Chard").trim();
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.id",
      "variants.title",
      "variants.price_set.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
    filters: { title },
  });

  if (!products?.length) {
    logger.warn(`No product found with title "${title}".`);
    return;
  }

  for (const p of products) {
    logger.info(`Product: ${p.title} (id: ${p.id})`);
    const variants = p.variants ?? [];
    for (const v of variants) {
      const priceSet = v.price_set;
      const prices = priceSet?.prices ?? [];
      if (prices.length === 0) {
        logger.info(`  Variant: ${v.title} (${v.id}) — no prices`);
      } else {
        for (const pr of prices) {
          const amountCents = pr?.amount ?? 0;
          const currency = pr?.currency_code ?? "";
          logger.info(`  Variant: ${v.title} (${v.id}) — ${(amountCents / 100).toFixed(2)} ${currency}`);
        }
      }
    }
  }
}
