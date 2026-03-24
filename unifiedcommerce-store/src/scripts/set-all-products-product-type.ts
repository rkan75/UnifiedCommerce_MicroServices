/**
 * Sets the product type on every product to a single type (default: "grocery").
 * Creates the product type if it does not exist.
 *
 * Usage (from backend root, DATABASE_URL set):
 *   npx medusa exec ./src/scripts/set-all-products-product-type.ts
 *
 * Optional:
 *   PRODUCT_TYPE_VALUE=Grocery   (display value; default: grocery)
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type ProductModule = {
  createProductTypes: (data: { value: string } | { value: string }[]) => Promise<{ id: string; value: string } | { id: string; value: string }[]>
  listAndCountProducts: (
    filters: Record<string, unknown>,
    config: { take?: number; skip?: number; relations?: string[] }
  ) => Promise<
    [
      { id: string; title?: string; type?: { id: string } | null }[],
      number,
    ]
  >
  /**
   * Use `type_id` only. Nested `type: { id, value }` makes Mikro `assign` try to persist a ProductType
   * row and can throw "Product type with id … already exists."
   */
  updateProducts: (id: string, data: { type_id: string | null }) => Promise<unknown>
}

export default async function setAllProductsProductType({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }

  const rawValue = (process.env.PRODUCT_TYPE_VALUE ?? "grocery").trim()
  const value = rawValue || "grocery"

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: {
      entity: string
      fields: string[]
      filters?: Record<string, unknown>
    }) => Promise<{ data: { id: string; value: string }[] }>
  }

  const productModule = container.resolve(Modules.PRODUCT) as ProductModule

  let typeId: string | undefined
  /** Resolved type label (logging / create path only; updates use `type_id`). */
  let typeValue: string | undefined

  try {
    const { data: existingTypes } = await query.graph({
      entity: "product_type",
      fields: ["id", "value"],
      filters: { value },
    })

    if (existingTypes?.length) {
      typeId = existingTypes[0].id
      typeValue = existingTypes[0].value
      logger.info(`Using existing product type "${typeValue}" (${typeId}).`)
    }
  } catch (e) {
    logger.warn(
      `Query for product_type failed (${e instanceof Error ? e.message : String(e)}); will try create.`
    )
  }

  if (!typeId) {
    try {
      const created = await productModule.createProductTypes({ value })
      const row = Array.isArray(created) ? created[0] : created
      typeId = row?.id
      typeValue = row?.value ?? value
      if (typeId) {
        logger.info(`Created product type "${typeValue}" (${typeId}).`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.toLowerCase().includes("unique") && !msg.toLowerCase().includes("duplicate")) {
        logger.error(`Could not create product type: ${msg}`)
        return
      }
      const { data: allTypes } = await query.graph({
        entity: "product_type",
        fields: ["id", "value"],
      })
      const found = allTypes?.find((t) => t.value === value)
      if (found) {
        typeId = found.id
        typeValue = found.value
        logger.info(`Product type "${typeValue}" already existed (${typeId}).`)
      } else {
        logger.error(`Product type "${value}" exists but could not be resolved. ${msg}`)
        return
      }
    }
  }

  if (!typeId) {
    logger.error("Failed to resolve product type id.")
    return
  }
  if (!typeValue) {
    typeValue = value
    logger.info(`Using PRODUCT_TYPE_VALUE "${typeValue}" for type payload (value was missing from lookup).`)
  }

  const batchSize = 200
  let skip = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (;;) {
    const [products, count] = await productModule.listAndCountProducts(
      {},
      { take: batchSize, skip, relations: ["type"] }
    )

    if (!products.length) {
      break
    }

    for (const product of products) {
      if (product.type?.id === typeId) {
        totalSkipped++
        continue
      }
      try {
        await productModule.updateProducts(product.id, {
          type_id: typeId,
        })
        totalUpdated++
      } catch (err) {
        totalFailed++
        logger.warn(
          `Failed to update product ${product.id} (${product.title ?? "no title"}): ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }

    skip += products.length
    if (skip >= count) {
      break
    }
  }

  logger.info(
    `Done. Product type "${value}": updated ${totalUpdated} product(s), skipped (already set) ${totalSkipped}, failed ${totalFailed}.`
  )
}
