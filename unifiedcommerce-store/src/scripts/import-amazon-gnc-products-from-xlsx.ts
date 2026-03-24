/**
 * Import / upsert products from data/amazon_gnc_product_details.xlsx (Amazon GNC scrape).
 *
 * - Creates new products or updates existing ones matched by handle (`amazon-{asin}`).
 * - Sets product type to Health & Wellness (default type id below, overridable).
 * - Writes rich metadata from all Excel columns + import/stock location fields.
 * - Sets variant price (region currency), images, variant–image links.
 * - Ensures inventory levels at the default stock location (stocked quantity configurable).
 *
 * Prerequisites: DATABASE_URL, Medusa backend deps, default region/shipping profile/sales channel/stock location in DB.
 *
 * Usage (from unifiedcommerce-store root):
 *   npx medusa exec ./src/scripts/import-amazon-gnc-products-from-xlsx.ts
 *
 * Environment (optional):
 *   EXCEL_FILE=data/amazon_gnc_product_details.xlsx
 *   PRODUCT_TYPE_ID=ptyp_01KM44HB9H03N9JPVC3Q79Y4XE
 *   DEFAULT_STOCKED_QUANTITY=100
 *   STOCK_LOCATION_ID=sloc_...     (overrides auto-picked first location)
 *   SALES_CHANNEL_ID=sc_...        (overrides auto-picked first channel)
 *   SHIPPING_PROFILE_ID=sp_...     (overrides auto-picked default profile)
 *   IMPORT_BATCH_SIZE=10           (products per batchProductsWorkflow call)
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  batchProductsWorkflow,
  batchVariantImagesWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as XLSX from "xlsx"

const DEFAULT_EXCEL = "amazon_gnc_product_details.xlsx"
const DEFAULT_PRODUCT_TYPE_ID = "ptyp_01KM44HB9H03N9JPVC3Q79Y4XE"
const DATA_DIR = path.join(process.cwd(), "data")

const COL = {
  productType: "Product Type",
  title: "Title",
  brand: "Brand",
  flavor: "Flavor",
  productBenefits: "Product Benefits",
  proteinSource: "Protein Source",
  unitCount: "Unit Count",
  aboutItem: "About this item details",
  numberOfItems: "Number of items",
  itemDimensions: "Item Dimensions",
  userGuide: "User guide",
  ingredients: "Ingredients",
  direction: "Direction",
  legalDisclaimer: "Legal disclaimer",
  productDescription: "Product description",
  mainImage: "Main image URL",
  otherImages: "Other image URLs",
  price: "Price",
  productUrl: "Product URL",
} as const

function parsePrice(priceStr: string | number | undefined): number | null {
  if (priceStr === undefined || priceStr === null) return null
  if (typeof priceStr === "number") {
    if (Number.isNaN(priceStr) || priceStr <= 0) return null
    return Math.round(priceStr * 100)
  }
  const cleaned = String(priceStr).replace(/[$,\s]/g, "").trim()
  if (!cleaned) return null
  const price = parseFloat(cleaned)
  if (Number.isNaN(price) || price <= 0) return null
  return Math.round(price * 100)
}

function extractAmazonAsin(url: string): string | null {
  const u = (url || "").trim()
  if (!u) return null
  const m = u.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  return m ? m[1].toUpperCase() : null
}

function slugifyTitle(title: string, suffix: string): string {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return `${base || "product"}-${suffix}`.slice(0, 100)
}

function splitImageUrls(other: string): string[] {
  if (!other || !String(other).trim()) return []
  return String(other)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Medusa metadata: keep JSON-serializable primitives; stringify long text. */
function cellToMetadataValue(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null) return null
  if (typeof v === "boolean" || typeof v === "number") return v
  const s = String(v).trim()
  if (!s) return null
  return s.length > 32000 ? `${s.slice(0, 32000)}…` : s
}

function rowToMetadata(
  row: Record<string, unknown>,
  extras: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  const skip = new Set<string>(["__rowNum__"])
  for (const [k, v] of Object.entries(row)) {
    if (skip.has(k)) continue
    const key = k.replace(/\s+/g, "_").toLowerCase()
    const val = cellToMetadataValue(v)
    if (val !== null) out[`excel_${key}`] = val
  }
  for (const [k, v] of Object.entries(extras)) {
    if (v === null || v === undefined) continue
    out[k] = v
  }
  return out
}

type GraphQuery = {
  graph: (args: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: Record<string, unknown>[] }>
}

async function resolveStockLocationId(
  query: GraphQuery,
  logger: { warn: (m: string) => void }
): Promise<string | null> {
  const envId = process.env.STOCK_LOCATION_ID?.trim()
  if (envId) return envId
  for (const entity of ["stock_location", "location"]) {
    try {
      const { data } = await query.graph({
        entity,
        fields: ["id", "name"],
      })
      const first = data?.[0] as { id?: string } | undefined
      if (first?.id) return first.id
    } catch {
      /* try next */
    }
  }
  logger.warn(
    "Could not resolve a stock location via Query API. Set STOCK_LOCATION_ID. Inventory levels will be skipped."
  )
  return null
}

async function resolveSalesChannelId(
  query: GraphQuery,
  logger: { warn: (m: string) => void }
): Promise<string | null> {
  const envId = process.env.SALES_CHANNEL_ID?.trim()
  if (envId) return envId
  try {
    const { data } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })
    const first = data?.[0] as { id?: string } | undefined
    if (first?.id) return first.id
  } catch (e) {
    logger.warn(`sales_channel query failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  logger.warn("No sales channel resolved. Set SALES_CHANNEL_ID. Product creation may fail.")
  return null
}

async function resolveShippingProfileId(
  query: GraphQuery,
  logger: { warn: (m: string) => void }
): Promise<string | null> {
  const envId = process.env.SHIPPING_PROFILE_ID?.trim()
  if (envId) return envId
  try {
    const { data } = await query.graph({
      entity: "shipping_profile",
      fields: ["id", "name", "type"],
    })
    const defaultProfile =
      (data as { id?: string; type?: string }[] | undefined)?.find(
        (p) => (p.type || "").toLowerCase() === "default"
      ) || (data as { id?: string }[] | undefined)?.[0]
    if (defaultProfile?.id) return defaultProfile.id
  } catch (e) {
    logger.warn(`shipping_profile query failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  logger.warn("No shipping profile resolved. Set SHIPPING_PROFILE_ID. Product creation may fail.")
  return null
}

type PreparedRow = {
  handle: string
  sku: string
  asin: string | null
  title: string
  description: string
  subtitle: string | null
  thumbnail: string | null
  imageUrls: string[]
  priceCents: number | null
  metadata: Record<string, string | number | boolean>
  rawRow: Record<string, unknown>
}

function prepareRow(row: Record<string, unknown>, index: number): PreparedRow | null {
  const title = String(row[COL.title] ?? "").trim()
  if (!title) {
    return null
  }
  const productUrl = String(row[COL.productUrl] ?? "").trim()
  const asin = extractAmazonAsin(productUrl)
  const handle = asin
    ? `amazon-${asin.toLowerCase()}`
    : slugifyTitle(title, String(index))

  const main = String(row[COL.mainImage] ?? "").trim()
  const others = splitImageUrls(String(row[COL.otherImages] ?? ""))
  const imageUrls = [...(main ? [main] : []), ...others.filter((u) => u !== main)].slice(0, 8)

  const priceCents = parsePrice(row[COL.price] as string | number)

  const descParts = [
    String(row[COL.productDescription] ?? "").trim(),
    String(row[COL.aboutItem] ?? "").trim(),
  ].filter(Boolean)
  const description = descParts.join("\n\n") || title
  const subtitle =
    String(row[COL.productBenefits] ?? "").trim() ||
    String(row[COL.flavor] ?? "").trim() ||
    null

  const metadata = rowToMetadata(row as Record<string, unknown>, {
    import_source: "amazon_gnc_xlsx",
    amazon_asin: asin,
    amazon_product_url: productUrl || null,
    product_type_label: String(row[COL.productType] ?? "Health & Wellness").trim() || "Health & Wellness",
  })

  return {
    handle,
    sku: handle.replace(/-/g, "_").slice(0, 100),
    asin,
    title,
    description,
    subtitle,
    thumbnail: main || null,
    imageUrls,
    priceCents,
    metadata,
    rawRow: row,
  }
}

export default async function importAmazonGncProductsFromXlsx({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as {
    info: (m: string) => void
    warn: (m: string) => void
    error: (m: string) => void
  }

  const productModule = container.resolve(Modules.PRODUCT) as {
    listProducts: (
      filters: Record<string, unknown>,
      config: { take?: number; relations?: string[] }
    ) => Promise<
      {
        id: string
        title?: string
        handle?: string
        metadata?: Record<string, unknown> | null
        images?: { id: string; url?: string }[]
        variants?: { id: string; sku?: string }[]
      }[]
    >
    retrieveProduct: (
      id: string,
      config: { relations?: string[] }
    ) => Promise<{
      id: string
      images?: { id: string; url?: string }[]
      variants?: { id: string }[]
    }>
  }

  const regionModule = container.resolve(Modules.REGION) as {
    listRegions: (filters: unknown, config: { take?: number }) => Promise<{ currency_code?: string }[]>
  }

  const inventoryModule = container.resolve(Modules.INVENTORY) as {
    createInventoryLevels: (
      input:
        | { inventory_item_id: string; location_id: string; stocked_quantity: number }
        | { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
    ) => Promise<unknown>
    updateInventoryLevels: (input: { id: string; stocked_quantity: number }) => Promise<unknown>
    retrieveInventoryLevelByItemAndLocation: (
      inventoryItemId: string,
      locationId: string
    ) => Promise<{ id: string; stocked_quantity?: number }>
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery

  const productTypeId =
    process.env.PRODUCT_TYPE_ID?.trim() || DEFAULT_PRODUCT_TYPE_ID
  const stockedQuantity = Math.max(
    0,
    Number.parseInt(process.env.DEFAULT_STOCKED_QUANTITY || "100", 10) || 100
  )
  const batchSize = Math.max(
    1,
    Math.min(50, Number.parseInt(process.env.IMPORT_BATCH_SIZE || "10", 10) || 10)
  )

  const excelPath =
    process.env.EXCEL_FILE?.trim() || path.join(DATA_DIR, DEFAULT_EXCEL)
  if (!fs.existsSync(excelPath)) {
    logger.error(`Excel not found: ${excelPath}`)
    return
  }

  const regions = await regionModule.listRegions({}, { take: 5 })
  const currencyCode = (regions[0]?.currency_code || "usd").toLowerCase()
  if (!regions.length) {
    logger.warn("No region found; using currency usd for prices.")
  }

  const stockLocationId = await resolveStockLocationId(query, logger)
  let stockLocationName = ""
  if (stockLocationId) {
    try {
      const { data: locRows } = await query.graph({
        entity: "stock_location",
        fields: ["id", "name"],
        filters: { id: stockLocationId },
      })
      stockLocationName = String((locRows?.[0] as { name?: string })?.name ?? "")
    } catch {
      stockLocationName = ""
    }
  }
  const salesChannelId = await resolveSalesChannelId(query, logger)
  const shippingProfileId = await resolveShippingProfileId(query, logger)

  if (!salesChannelId || !shippingProfileId) {
    logger.error("Missing sales channel or shipping profile. Fix env or seed store defaults.")
    return
  }

  const wb = XLSX.readFile(excelPath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
  const prepared: PreparedRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const p = prepareRow(rows[i], i)
    if (p) prepared.push(p)
  }

  logger.info(
    `Loaded ${prepared.length} row(s) from ${excelPath}. Product type: ${productTypeId}. Stock qty: ${stockedQuantity}. Batch: ${batchSize}.`
  )

  const optionTitle = "Size"
  const optionValue = "One Size"

  for (let offset = 0; offset < prepared.length; offset += batchSize) {
    const slice = prepared.slice(offset, offset + batchSize)
    const toCreate: Record<string, unknown>[] = []
    const toUpdate: Record<string, unknown>[] = []

    for (const pr of slice) {
      const existingList = await productModule.listProducts(
        { handle: pr.handle },
        { take: 1, relations: ["variants", "images"] }
      )
      const existing = existingList[0]

      const imagesPayload = pr.imageUrls.map((url) => ({ url }))

      if (!existing) {
        if (pr.priceCents == null) {
          logger.warn(`Skip create (no price): ${pr.title.slice(0, 60)}…`)
          continue
        }
        toCreate.push({
          title: pr.title,
          handle: pr.handle,
          subtitle: pr.subtitle ?? undefined,
          description: pr.description,
          is_giftcard: false,
          discountable: true,
          status: "published",
          type_id: productTypeId,
          metadata: {
            ...pr.metadata,
            ...(stockLocationId
              ? {
                  stock_location_id: stockLocationId,
                  stock_location_name: stockLocationName,
                  default_stocked_quantity: stockedQuantity,
                }
              : {}),
          },
          thumbnail: pr.thumbnail ?? undefined,
          images: imagesPayload.length ? imagesPayload : undefined,
          sales_channels: [{ id: salesChannelId }],
          shipping_profile_id: shippingProfileId,
          options: [{ title: optionTitle, values: [optionValue] }],
          variants: [
            {
              title: `${pr.title.slice(0, 80)} — ${optionValue}`,
              sku: pr.sku,
              options: { [optionTitle]: optionValue },
              manage_inventory: true,
              prices: [{ amount: pr.priceCents, currency_code: currencyCode }],
            },
          ],
        })
      } else {
        const mergedMeta = {
          ...(existing.metadata && typeof existing.metadata === "object"
            ? existing.metadata
            : {}),
          ...pr.metadata,
          ...(stockLocationId
            ? {
                stock_location_id: stockLocationId,
                stock_location_name: stockLocationName,
                default_stocked_quantity: stockedQuantity,
              }
            : {}),
        }

        const existingImages = (existing.images ?? []) as { id: string; url?: string }[]
        let mergedImages: { id?: string; url: string }[] | undefined
        if (imagesPayload.length) {
          mergedImages = []
          const urls = pr.imageUrls
          const max = Math.min(Math.max(existingImages.length, urls.length), 8)
          for (let i = 0; i < max; i++) {
            if (i < urls.length) {
              if (i < existingImages.length) {
                mergedImages.push({ id: existingImages[i].id, url: urls[i] })
              } else {
                mergedImages.push({ url: urls[i] })
              }
            } else if (i < existingImages.length) {
              mergedImages.push({
                id: existingImages[i].id,
                url: urls[urls.length - 1] || urls[0],
              })
            }
          }
        }

        toUpdate.push({
          id: existing.id,
          title: pr.title,
          subtitle: pr.subtitle ?? undefined,
          description: pr.description,
          type_id: productTypeId,
          metadata: mergedMeta,
          thumbnail: pr.thumbnail ?? existing.thumbnail,
          ...(mergedImages?.length ? { images: mergedImages } : {}),
          shipping_profile_id: shippingProfileId,
          sales_channels: [{ id: salesChannelId }],
        })
      }
    }

    if (toCreate.length === 0 && toUpdate.length === 0) {
      continue
    }

    const batchRun = await batchProductsWorkflow(container).run({
      input: {
        create: toCreate as never,
        update: toUpdate as never,
      },
    })
    const batchPayload = (batchRun as { result?: { created?: unknown[]; updated?: unknown[] } })
      .result ?? (batchRun as { created?: unknown[]; updated?: unknown[] })

    const touchedProducts = [
      ...((batchPayload as { created?: unknown[] }).created ?? []),
      ...((batchPayload as { updated?: unknown[] }).updated ?? []),
    ] as { id: string; handle?: string; variants?: { id: string }[] }[]

    const variantPrices: {
      variant_id: string
      product_id: string
      prices: { amount: number; currency_code: string }[]
    }[] = []

    for (const product of touchedProducts) {
      const prod = product as {
        id: string
        handle?: string
        variants?: { id: string }[]
      }
      const variants = prod.variants ?? []
      const sliceRow = slice.find((r) => r.handle === prod.handle)
      for (const v of variants) {
        const cents = sliceRow?.priceCents
        if (cents != null) {
          variantPrices.push({
            variant_id: v.id,
            product_id: prod.id,
            prices: [{ amount: cents, currency_code: currencyCode }],
          })
        }
      }
    }

    if (variantPrices.length) {
      await upsertVariantPricesWorkflow(container).run({
        input: {
          variantPrices,
          previousVariantIds: variantPrices.map((x) => x.variant_id),
        },
      })
    }

    for (const product of touchedProducts) {
      const p = product
      try {
        const full = await productModule.retrieveProduct(p.id, {
          relations: ["images", "variants"],
        })
        const imgs = full.images ?? []
        const firstImageId = imgs[0]?.id
        const variantIds = (full.variants ?? []).map((v) => v.id)
        if (firstImageId && variantIds.length) {
          for (const vid of variantIds) {
            await batchVariantImagesWorkflow(container).run({
              input: { variant_id: vid, add: [firstImageId] },
            })
          }
        }
      } catch (e) {
        logger.warn(
          `Variant images for ${p.handle ?? p.id}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    if (stockLocationId && stockedQuantity > 0) {
      const variantIds = touchedProducts.flatMap(
        (prod) => ((prod as { variants?: { id: string }[] }).variants ?? []).map((v) => v.id)
      )
      const links = await fetchVariantInventoryLinks(query, variantIds)
      for (const [, inventoryItemId] of links) {
        try {
          const level = await inventoryModule.retrieveInventoryLevelByItemAndLocation(
            inventoryItemId,
            stockLocationId
          )
          await inventoryModule.updateInventoryLevels({
            id: level.id,
            stocked_quantity: stockedQuantity,
          })
        } catch {
          try {
            await inventoryModule.createInventoryLevels({
              inventory_item_id: inventoryItemId,
              location_id: stockLocationId,
              stocked_quantity: stockedQuantity,
            })
          } catch (e2) {
            logger.warn(
              `Inventory level item=${inventoryItemId}: ${
                e2 instanceof Error ? e2.message : String(e2)
              }`
            )
          }
        }
      }
    }

    const cr = (batchPayload as { created?: unknown[] }).created?.length ?? 0
    const up = (batchPayload as { updated?: unknown[] }).updated?.length ?? 0
    logger.info(`Batch ${offset / batchSize + 1}: created ${cr}, updated ${up}`)
  }

  logger.info("Import finished.")
}

async function fetchVariantInventoryLinks(
  query: GraphQuery,
  variantIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!variantIds.length) return map

  const attempts: { entity: string; fields: string[] }[] = [
    {
      entity: "product_variant",
      fields: ["id", "inventory_items.inventory_item_id"],
    },
    { entity: "variant", fields: ["id", "inventory_items.inventory_item_id"] },
  ]

  for (const { entity, fields } of attempts) {
    try {
      const { data } = await query.graph({
        entity,
        fields,
        filters: { id: variantIds },
      })
      for (const row of data || []) {
        const id = row?.id as string | undefined
        const items = row?.inventory_items as
          | { inventory_item_id?: string }[]
          | undefined
        const iid = items?.[0]?.inventory_item_id
        if (id && iid) map.set(id, iid)
      }
      if (map.size) return map
    } catch {
      /* next */
    }
  }
  return map
}
