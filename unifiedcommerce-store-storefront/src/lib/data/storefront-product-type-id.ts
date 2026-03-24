"use server"

import {
  getStorefrontProductTypeId,
  getStorefrontProductTypeValue,
} from "@lib/config/storefront-product-scope"

/** Normalize Medusa product type `value` for comparison ("Health and Wellness" vs "health-and-wellness"). */
function normalizeProductTypeLabel(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

let resolvedPromise: Promise<string | null> | null = null

/**
 * Resolves the storefront product type id: `getStorefrontProductTypeId()` (env or default HW type), else
 * `STOREFRONT_PRODUCT_TYPE_VALUE` matched against `product.type.value`.
 * Used for PLP/category/collection scoping. Must not be called from `listProducts` while
 * `applyStorefrontProductTypeFilter === false` is the *only* path — that path skips calling this
 * (see `listProducts`) so value-resolution scans do not deadlock.
 */
export async function resolveStorefrontProductTypeId(
  countryCode: string | null | undefined
): Promise<string | null> {
  const fromEnvId = getStorefrontProductTypeId()
  if (fromEnvId) return fromEnvId

  const label = getStorefrontProductTypeValue()
  if (!label || !countryCode?.trim()) return null

  if (!resolvedPromise) {
    resolvedPromise = lookupProductTypeIdByValue(countryCode.trim(), label)
  }
  return resolvedPromise
}

async function lookupProductTypeIdByValue(
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
