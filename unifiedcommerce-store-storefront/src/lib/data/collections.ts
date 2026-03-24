"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { listProducts } from "./products"
import { resolveStorefrontProductTypeId } from "./storefront-product-type-id"

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        next,
        cache: "force-cache",
      }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {},
  /** When storefront product type is configured (id or value env), collections with no in-scope products are removed. */
  countryCode?: string
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"

  const { collections } = await sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      {
        query: queryParams,
        next,
        cache: "force-cache",
      }
    )
    .then((res) => res)

  const filtered = await filterCollectionsByStorefrontProductType(
    collections,
    countryCode
  )
  return { collections: filtered, count: filtered.length }
}

type ProductWithCollection = HttpTypes.StoreProduct & {
  collection?: { id?: string | null } | null
}

async function fetchCollectionIdsForStorefrontType(
  countryCode: string,
  typeId: string
): Promise<Set<string>> {
  const ids = new Set<string>()
  let offset = 0
  const limit = 200
  for (;;) {
    const { response } = await listProducts({
      countryCode,
      applyStorefrontProductTypeFilter: false,
      queryParams: {
        type_id: typeId,
        limit,
        offset,
        // Medusa v2 store API returns `collection` as a relation; `collection_id` alone is often omitted.
        fields: "id,+collection_id,*collection",
      },
    })
    for (const p of response.products) {
      const row = p as ProductWithCollection
      const cid =
        row.collection?.id ??
        (row as { collection_id?: string | null }).collection_id
      if (cid) ids.add(cid)
    }
    if (response.products.length < limit) break
    offset += limit
    if (offset > 200_000) break
  }
  return ids
}

async function filterCollectionsByStorefrontProductType(
  collections: HttpTypes.StoreCollection[],
  countryCode?: string
): Promise<HttpTypes.StoreCollection[]> {
  const typeId = await resolveStorefrontProductTypeId(countryCode ?? null)
  if (!typeId || !countryCode?.trim()) {
    return collections
  }
  const allowed = await fetchCollectionIdsForStorefrontType(countryCode, typeId)
  return collections.filter((c) => c.id && allowed.has(c.id))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields: "*products" },
      next,
      cache: "force-cache",
    })
    .then(({ collections }) => collections[0])
}
