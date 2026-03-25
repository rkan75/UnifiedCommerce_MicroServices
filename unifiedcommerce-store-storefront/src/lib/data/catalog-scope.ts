"use server"

import { unstable_cache } from "next/cache"
import {
  getMedusaPublishableKeyHeaders,
  getProductsServiceBaseUrl,
} from "@lib/config/products-service"
import { getStorefrontProductTypeConfigKey } from "@lib/config/storefront-product-scope"
import { STORE_PRODUCTS_CACHE_TAG } from "./cache-tags"
import { listProducts } from "./products"

const SCOPE_REVALIDATE =
  typeof process.env.NEXT_CATALOG_SCOPE_REVALIDATE_SECONDS !== "undefined"
    ? Number(process.env.NEXT_CATALOG_SCOPE_REVALIDATE_SECONDS)
    : 600

const PAGE_SIZE = 100
const PARALLEL_PAGES = 12
const MAX_OFFSET = 200_000

async function tryFetchCategoryIdsFromProductService(
  typeId: string
): Promise<string[] | null> {
  try {
    const base = getProductsServiceBaseUrl()
    const url = `${base}/store/catalog-scope/category-ids?${new URLSearchParams({ type_id: typeId })}`
    const res = await fetch(url, {
      method: "GET",
      headers: getMedusaPublishableKeyHeaders(),
      next: { revalidate: SCOPE_REVALIDATE, tags: [STORE_PRODUCTS_CACHE_TAG] },
      cache: "force-cache",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ids?: unknown }
    if (!data || !Array.isArray(data.ids)) return null
    return data.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
  } catch {
    return null
  }
}

async function tryFetchCollectionIdsFromProductService(
  typeId: string
): Promise<string[] | null> {
  try {
    const base = getProductsServiceBaseUrl()
    const url = `${base}/store/catalog-scope/collection-ids?${new URLSearchParams({ type_id: typeId })}`
    const res = await fetch(url, {
      method: "GET",
      headers: getMedusaPublishableKeyHeaders(),
      next: { revalidate: SCOPE_REVALIDATE, tags: [STORE_PRODUCTS_CACHE_TAG] },
      cache: "force-cache",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ids?: unknown }
    if (!data || !Array.isArray(data.ids)) return null
    return data.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
  } catch {
    return null
  }
}

async function categoryIdsParallelScan(
  countryCode: string,
  typeId: string
): Promise<string[]> {
  const ids = new Set<string>()
  let offset = 0
  for (;;) {
    const offsets: number[] = []
    for (
      let i = 0;
      i < PARALLEL_PAGES && offset + i * PAGE_SIZE <= MAX_OFFSET;
      i++
    ) {
      offsets.push(offset + i * PAGE_SIZE)
    }
    if (offsets.length === 0) break

    const pages = await Promise.all(
      offsets.map((off) =>
        listProducts({
          countryCode,
          applyStorefrontProductTypeFilter: false,
          queryParams: {
            type_id: typeId,
            limit: PAGE_SIZE,
            offset: off,
            fields: "id,*categories",
          },
        }).then((r) => r.response.products)
      )
    )

    let anyFull = false
    for (const products of pages) {
      for (const p of products) {
        for (const c of p.categories ?? []) {
          if (c?.id) ids.add(c.id)
        }
      }
      if (products.length === PAGE_SIZE) anyFull = true
    }
    if (!anyFull) break
    offset += PARALLEL_PAGES * PAGE_SIZE
    if (offset > MAX_OFFSET) break
  }
  return Array.from(ids)
}

async function collectionIdsParallelScan(
  countryCode: string,
  typeId: string
): Promise<string[]> {
  const ids = new Set<string>()
  let offset = 0
  for (;;) {
    const offsets: number[] = []
    for (
      let i = 0;
      i < PARALLEL_PAGES && offset + i * PAGE_SIZE <= MAX_OFFSET;
      i++
    ) {
      offsets.push(offset + i * PAGE_SIZE)
    }
    if (offsets.length === 0) break

    const pages = await Promise.all(
      offsets.map((off) =>
        listProducts({
          countryCode,
          applyStorefrontProductTypeFilter: false,
          queryParams: {
            type_id: typeId,
            limit: PAGE_SIZE,
            offset: off,
            fields: "id,+collection_id,*collection",
          },
        }).then((r) => r.response.products)
      )
    )

    let anyFull = false
    for (const products of pages) {
      for (const p of products) {
        const row = p as {
          collection?: { id?: string | null } | null
          collection_id?: string | null
        }
        const cid = row.collection?.id ?? row.collection_id
        if (cid) ids.add(cid)
      }
      if (products.length === PAGE_SIZE) anyFull = true
    }
    if (!anyFull) break
    offset += PARALLEL_PAGES * PAGE_SIZE
    if (offset > MAX_OFFSET) break
  }
  return Array.from(ids)
}

async function resolveCategoryIdsUncached(
  countryCode: string,
  typeId: string
): Promise<string[]> {
  const fast = await tryFetchCategoryIdsFromProductService(typeId)
  if (fast !== null) return fast
  return categoryIdsParallelScan(countryCode, typeId)
}

async function resolveCollectionIdsUncached(
  countryCode: string,
  typeId: string
): Promise<string[]> {
  const fast = await tryFetchCollectionIdsFromProductService(typeId)
  if (fast !== null) return fast
  return collectionIdsParallelScan(countryCode, typeId)
}

/**
 * Cached set of category ids that have at least one in-scope product (by Medusa type).
 * Prefer products-service SQL aggregation; falls back to parallel product paging if the endpoint is unavailable.
 */
export async function getCachedStorefrontCategoryIdSet(
  countryCode: string,
  typeId: string
): Promise<Set<string>> {
  const cfg = getStorefrontProductTypeConfigKey()
  const cc = countryCode?.trim() || "us"
  const arr = await unstable_cache(
    async () => resolveCategoryIdsUncached(cc, typeId),
    ["category-ids-for-storefront-type", typeId, cfg, cc],
    { revalidate: SCOPE_REVALIDATE, tags: [STORE_PRODUCTS_CACHE_TAG] }
  )()
  return new Set(arr)
}

export async function getCachedStorefrontCollectionIdSet(
  countryCode: string,
  typeId: string
): Promise<Set<string>> {
  const cfg = getStorefrontProductTypeConfigKey()
  const cc = countryCode?.trim() || "us"
  const arr = await unstable_cache(
    async () => resolveCollectionIdsUncached(cc, typeId),
    ["collection-ids-for-storefront-type", typeId, cfg, cc],
    { revalidate: SCOPE_REVALIDATE, tags: [STORE_PRODUCTS_CACHE_TAG] }
  )()
  return new Set(arr)
}
