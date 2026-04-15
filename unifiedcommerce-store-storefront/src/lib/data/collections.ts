"use server"

import {
  getCollectionsServiceBaseUrl,
  getMedusaPublishableKeyHeaders,
} from "@lib/config/products-service"
import { HttpTypes } from "@medusajs/types"
import { fetchWithConnectionContext } from "@lib/util/fetch-with-connection-context"
import { STORE_COLLECTIONS_CACHE_TAG } from "./cache-tags"
import { getCachedStorefrontCollectionIdSet } from "./catalog-scope"
import { resolveStorefrontProductTypeId } from "./storefront-product-type-id"

const COLLECTIONS_REVALIDATE =
  typeof process.env.NEXT_COLLECTIONS_REVALIDATE_SECONDS !== "undefined"
    ? Number(process.env.NEXT_COLLECTIONS_REVALIDATE_SECONDS)
    : 300

function collectionsFetchInit(): RequestInit {
  return {
    method: "GET",
    headers: getMedusaPublishableKeyHeaders(),
    next: {
      revalidate: COLLECTIONS_REVALIDATE,
      tags: [STORE_COLLECTIONS_CACHE_TAG],
    },
    cache: "force-cache",
  }
}

export const retrieveCollection = async (id: string) => {
  const base = getCollectionsServiceBaseUrl()
  const url = `${base}/store/collections/${encodeURIComponent(id)}`
  const res = await fetchWithConnectionContext(url, collectionsFetchInit())
  if (!res.ok) return null
  const data = (await res.json()) as { collection?: HttpTypes.StoreCollection }
  return data.collection ?? null
}

export const listCollections = async (
  queryParams: Record<string, string> = {},
  /** When storefront product type is configured (id or value env), collections with no in-scope products are removed. */
  countryCode?: string
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const limit = queryParams.limit || "100"
  const offset = queryParams.offset || "0"

  const sp = new URLSearchParams()
  sp.set("limit", limit)
  sp.set("offset", offset)
  for (const [k, v] of Object.entries(queryParams)) {
    if (k === "limit" || k === "offset" || v === undefined) continue
    sp.set(k, v)
  }

  const base = getCollectionsServiceBaseUrl()
  const url = `${base}/store/collections?${sp.toString()}`
  const res = await fetchWithConnectionContext(url, collectionsFetchInit())
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(
      `collections-service GET /store/collections failed: ${res.status} ${t.slice(0, 200)}`
    )
  }
  const data = (await res.json()) as {
    collections?: HttpTypes.StoreCollection[]
    count?: number
  }
  const collections = data.collections ?? []
  const filtered = await filterCollectionsByStorefrontProductType(
    collections,
    countryCode
  )
  return { collections: filtered, count: filtered.length }
}

async function filterCollectionsByStorefrontProductType(
  collections: HttpTypes.StoreCollection[],
  countryCode?: string
): Promise<HttpTypes.StoreCollection[]> {
  const typeId = await resolveStorefrontProductTypeId(countryCode ?? null)
  if (!typeId || !countryCode?.trim()) {
    return collections
  }
  const allowed = await getCachedStorefrontCollectionIdSet(countryCode, typeId)
  if (allowed.size === 0 && collections.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[collections] No products returned collection_id for storefront type filter; showing all collections. Ensure products-service includes collection_id on GET /store/products (or set STOREFRONT_PRODUCT_TYPE_ID=all)."
      )
    }
    return collections
  }
  return collections.filter((c) => c.id && allowed.has(c.id))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection | undefined> => {
  const base = getCollectionsServiceBaseUrl()
  const sp = new URLSearchParams()
  sp.set("handle", handle)
  const url = `${base}/store/collections?${sp.toString()}`
  const res = await fetchWithConnectionContext(url, collectionsFetchInit())
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(
      `collections-service GET /store/collections?handle= failed: ${res.status} ${t.slice(0, 200)}`
    )
  }
  const data = (await res.json()) as {
    collections?: HttpTypes.StoreCollection[]
  }
  const list = data.collections ?? []
  return list[0]
}
