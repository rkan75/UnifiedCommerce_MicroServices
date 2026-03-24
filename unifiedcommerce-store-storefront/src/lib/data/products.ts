"use server"

import { unstable_cache } from "next/cache"
import { sdk } from "@lib/config"
import { getStorefrontProductTypeConfigKey } from "@lib/config/storefront-product-scope"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"
import { resolveStorefrontProductTypeId } from "./storefront-product-type-id"

/** Cache key for raw product list (no price filter) so price-filter clicks reuse the same data */
const RAW_PRODUCTS_CACHE_TAG = "store-products-raw"
/** Revalidate product list after this many seconds so price changes in Admin reflect within a short delay. For immediate refresh, call POST /api/revalidate. */
const RAW_PRODUCTS_REVALIDATE =
  typeof process.env.NEXT_PRODUCTS_REVALIDATE_SECONDS !== "undefined"
    ? Number(process.env.NEXT_PRODUCTS_REVALIDATE_SECONDS)
    : 60

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  /**
   * When false, do not apply `STOREFRONT_PRODUCT_TYPE_ID` (e.g. gift-only category
   * or admin-style fetches). Default true when the env var is set.
   */
  applyStorefrontProductTypeFilter = true,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
  applyStorefrontProductTypeFilter?: boolean
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  const effectiveCountry =
    countryCode?.trim() ||
    region?.countries?.find((c) => c?.iso_2)?.iso_2 ||
    ""

  const scopedTypeId = applyStorefrontProductTypeFilter
    ? await resolveStorefrontProductTypeId(effectiveCountry || null)
    : null
  const mergedQuery: HttpTypes.FindParams & HttpTypes.StoreProductListParams = {
    ...(queryParams ?? {}),
  }
  if (applyStorefrontProductTypeFilter && scopedTypeId) {
    mergedQuery.type_id = scopedTypeId
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*categories,*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.thumbnail,+metadata,+tags,",
          ...mergedQuery,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams: mergedQuery,
      }
    })
}

/**
 * Get a single product by handle. Returns null if not found.
 */
export async function getProductByHandle(
  handle: string,
  countryCode: string
): Promise<HttpTypes.StoreProduct | null> {
  if (!handle?.trim()) return null
  const { response } = await listProducts({
    countryCode,
    queryParams: {
      handle: handle.trim(),
      limit: 1,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.thumbnail,+metadata,+tags,",
    },
  })
  return response.products[0] ?? null
}

/**
 * Fetch multiple products by id. Returns a map of product id -> product for quick lookup.
 */
export async function getProductsByIds(
  countryCode: string,
  ids: string[],
  options?: {
    /** Set true to load products regardless of `STOREFRONT_PRODUCT_TYPE_ID` (e.g. order receipts). */
    bypassStorefrontProductTypeFilter?: boolean
  }
): Promise<Map<string, HttpTypes.StoreProduct>> {
  const uniqueIds = [...new Set(ids)].filter(Boolean)
  if (!uniqueIds.length) return new Map()
  const { response } = await listProducts({
    countryCode,
    applyStorefrontProductTypeFilter: !options?.bypassStorefrontProductTypeFilter,
    queryParams: {
      id: uniqueIds,
      limit: uniqueIds.length,
      fields:
        "*variants,*variants.calculated_price,*variants.thumbnail,*thumbnail,*images",
    },
  })
  const map = new Map<string, HttpTypes.StoreProduct>()
  for (const p of response.products) {
    if (p?.id) map.set(p.id, p)
  }
  return map
}

/**
 * Get minimum price from product variants in minor unit (cents).
 * Matches getProductPrice logic: only variants with calculated_price, then min.
 * Store API calculated_amount is in minor unit; convert to major (dollars) for priceMin/priceMax comparison.
 */
function getProductMinPriceCents(product: HttpTypes.StoreProduct): number {
  if (!product.variants?.length) return Infinity
  const amounts = (product.variants as { calculated_price?: { calculated_amount?: number } }[])
    .filter((v) => v?.calculated_price?.calculated_amount != null)
    .map((v) => v.calculated_price!.calculated_amount!)
  if (!amounts.length) return Infinity
  return Math.min(...amounts)
}

/** Convert variant min price to dollars for filter comparison (priceMin/priceMax are in dollars). */
function getProductMinPriceInDollars(product: HttpTypes.StoreProduct): number {
  const cents = getProductMinPriceCents(product)
  return cents === Infinity ? Infinity : cents / 100
}

/**
 * Fetch raw product list. Uses unstable_cache when payload would be under Next.js 2MB cache limit;
 * otherwise fetches without cache. Price filter still works in-memory on the fetched slice.
 */
async function getCachedRawProducts(
  countryCode: string,
  queryParams: HttpTypes.FindParams & HttpTypes.StoreProductParams & { q?: string },
  fetchLimit: number
): Promise<HttpTypes.StoreProduct[]> {
  const params = queryParams as { category_id?: string[]; collection_id?: string[]; q?: string }

  const doFetch = async (): Promise<HttpTypes.StoreProduct[]> => {
    const { response } = await listProducts({
      pageParam: 1,
      queryParams: { ...queryParams, limit: fetchLimit },
      countryCode,
      /** Only products of `STOREFRONT_PRODUCT_TYPE_ID` when set (see storefront-product-scope). */
      applyStorefrontProductTypeFilter: true,
    })
    return response.products
  }

  // Next.js unstable_cache has a 2MB limit; large product lists exceed it. Use cache only for smaller fetches.
  const CACHE_LIMIT = 80
  if (fetchLimit > CACHE_LIMIT) {
    return doFetch()
  }

  const cacheKey = [
    RAW_PRODUCTS_CACHE_TAG,
    countryCode,
    getStorefrontProductTypeConfigKey(),
    params.category_id?.[0] ?? "",
    params.collection_id?.[0] ?? "",
    params.q?.trim() ?? "",
    String(fetchLimit),
  ]
  try {
    const cached = unstable_cache(
      doFetch,
      cacheKey,
      { revalidate: RAW_PRODUCTS_REVALIDATE, tags: [RAW_PRODUCTS_CACHE_TAG] }
    )
    return await cached()
  } catch (err) {
    // If cache fails (e.g. "items over 2MB can not be cached"), fall back to uncached fetch
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("2MB") || message.includes("can not be cached")) {
      return doFetch()
    }
    throw err
  }
}

/**
 * Products after category/collection scope, text search, and price filter.
 * Raw fetch uses `listProducts` with `applyStorefrontProductTypeFilter: true` so results respect
 * `STOREFRONT_PRODUCT_TYPE_ID` when set.
 */
async function getListingProductsBeforeBrandFilter({
  countryCode,
  queryParams,
  q,
  priceMin,
  priceMax,
}: {
  countryCode: string
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams & { q?: string }
  q?: string
  priceMin?: number
  priceMax?: number
}): Promise<HttpTypes.StoreProduct[]> {
  const searchTerm = (q || (queryParams as { q?: string })?.q || "").trim().toLowerCase()
  const fetchLimit = searchTerm ? 200 : 250

  const rawProducts = await getCachedRawProducts(
    countryCode,
    { ...(queryParams ?? {}), limit: fetchLimit },
    fetchLimit
  )

  let products = searchTerm
    ? rawProducts.filter((p) => {
        const title = (p.title || "").toLowerCase()
        const desc = ((p.description || "") as string).toLowerCase()
        return title.includes(searchTerm) || desc.includes(searchTerm)
      })
    : rawProducts

  if (priceMin !== undefined || priceMax !== undefined) {
    products = products.filter((p) => {
      const minPriceDollars = getProductMinPriceInDollars(p)
      if (minPriceDollars === Infinity) return false
      if (priceMin !== undefined && minPriceDollars < priceMin) return false
      if (priceMax !== undefined && minPriceDollars >= priceMax) return false
      return true
    })
  }

  return products
}

/**
 * Fetch products, sort, and paginate. Uses cached raw list when possible so price-filter clicks are fast.
 * When priceMin/priceMax are provided, filters by variant min price in memory (no extra fetch).
 */
export const listProductsWithSort = async ({
  page = 1,
  queryParams,
  sortBy = "created_at",
  countryCode,
  q,
  priceMin,
  priceMax,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams & { q?: string }
  sortBy?: SortOptions
  countryCode: string
  q?: string
  priceMin?: number
  priceMax?: number
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12
  const pageNum = Math.max(1, Number(page) || 1)

  let products = await getListingProductsBeforeBrandFilter({
    countryCode,
    queryParams,
    q,
    priceMin,
    priceMax,
  })

  const count = products.length

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (pageNum - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}
