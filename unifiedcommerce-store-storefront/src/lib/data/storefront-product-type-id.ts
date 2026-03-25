"use server"

import {
  getStorefrontProductTypeId,
  getStorefrontProductTypeValue,
} from "@lib/config/storefront-product-scope"
import { unstable_cache } from "next/cache"
import { cache } from "react"
import { STORE_PRODUCTS_CACHE_TAG } from "./cache-tags"

/** Normalize Medusa product type `value` for comparison ("Health and Wellness" vs "health-and-wellness"). */
function normalizeProductTypeLabel(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

/**
 * Resolves the storefront product type id: `getStorefrontProductTypeId()` (env or default HW type), else
 * `STOREFRONT_PRODUCT_TYPE_VALUE` matched against `product.type.value`.
 * Used for PLP/category/collection scoping. Must not be called from `listProducts` while
 * `applyStorefrontProductTypeFilter === false` is the *only* path — that path skips calling this
 * (see `listProducts`) so value-resolution scans do not deadlock.
 *
 * Wrapped in React `cache()` so listCollections + listCategories in the same request share one resolution.
 */
export const resolveStorefrontProductTypeId = cache(
  async function resolveStorefrontProductTypeId(
    countryCode: string | null | undefined
  ): Promise<string | null> {
    const fromEnvId = getStorefrontProductTypeId()
    if (fromEnvId) return fromEnvId

    const label = getStorefrontProductTypeValue()
    if (!label || !countryCode?.trim()) return null

    const cc = countryCode.trim()
    const normalized = normalizeProductTypeLabel(label)
    return unstable_cache(
      async () => lookupProductTypeIdByValueUncached(cc, label),
      ["storefront-product-type-value", cc, normalized],
      { revalidate: 3600, tags: [STORE_PRODUCTS_CACHE_TAG] }
    )()
  }
)

async function lookupProductTypeIdByValueUncached(
  countryCode: string,
  wanted: string
): Promise<string | null> {
  const { listProducts } = await import("./products")
  const target = normalizeProductTypeLabel(wanted)
  let offset = 0
  const limit = 100
  for (let page = 0; page < 500; page++) {
    const { response } = await listProducts({
      countryCode,
      applyStorefrontProductTypeFilter: false,
      queryParams: {
        limit,
        offset,
        fields: "id,*type",
      },
    })
    for (const p of response.products) {
      const t = p.type as { id?: string; value?: string } | null | undefined
      if (t?.id && normalizeProductTypeLabel(t.value ?? "") === target) {
        return t.id
      }
    }
    if (response.products.length < limit) break
    offset += limit
  }
  return null
}
