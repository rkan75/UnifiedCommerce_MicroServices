import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { listProducts } from "./products"
import { resolveStorefrontProductTypeId } from "./storefront-product-type-id"

export const listCategories = async (
  query?: Record<string, any>,
  /** When storefront product type is configured (id or value env), categories with no in-scope products are removed. */
  countryCode?: string
) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  const product_categories = await sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories: rows }) => rows)

  return filterCategoriesByStorefrontProductType(product_categories, countryCode)
}

async function fetchCategoryIdsForStorefrontType(
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
        fields: "id,*categories",
      },
    })
    for (const p of response.products) {
      for (const c of p.categories ?? []) {
        if (c?.id) ids.add(c.id)
      }
    }
    if (response.products.length < limit) break
    offset += limit
    if (offset > 200_000) break
  }
  return ids
}

function filterCategoryNode(
  cat: HttpTypes.StoreProductCategory,
  allowed: Set<string>
): HttpTypes.StoreProductCategory | null {
  const rawChildren = cat.category_children ?? []
  const nextChildren = rawChildren
    .map((ch) => filterCategoryNode(ch, allowed))
    .filter((x): x is HttpTypes.StoreProductCategory => x != null)
  const keepSelf = allowed.has(cat.id)
  if (!keepSelf && nextChildren.length === 0) return null
  return {
    ...cat,
    category_children: nextChildren,
  }
}

async function filterCategoriesByStorefrontProductType(
  categories: HttpTypes.StoreProductCategory[],
  countryCode?: string
): Promise<HttpTypes.StoreProductCategory[]> {
  const typeId = await resolveStorefrontProductTypeId(countryCode ?? null)
  if (!typeId || !countryCode?.trim()) {
    return categories
  }
  const allowed = await fetchCategoryIdsForStorefrontType(countryCode, typeId)
  return categories
    .map((c) => filterCategoryNode(c, allowed))
    .filter((x): x is HttpTypes.StoreProductCategory => x != null)
}

/** Slugify for fallback match: lowercase, replace non-alphanumeric with hyphen, collapse hyphens */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

/** Normalize handle for comparison: slugify and optionally strip "-and-" so "dairy-and-eggs" matches "dairy-eggs" */
function normalizeHandle(h: string): string {
  const s = slugify(h).replace(/-and-/g, "-")
  return s.replace(/-+/g, "-")
}

export const getCategoryByHandle = async (
  categoryHandle: string[],
  countryCode?: string
) => {
  const rawHandle = `${categoryHandle.join("/")}`
  const handle = rawHandle
    .split("/")
    .map((s) => decodeURIComponent(s))
    .join("/")

  const next = {
    ...(await getCacheOptions("categories")),
  }

  const result = await sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])

  if (result) return result

  const all = await listCategories({ limit: 500 }, countryCode)
  const handleNorm = normalizeHandle(handle)
  const found =
    all?.find(
      (c) =>
        c.handle?.toLowerCase() === handle.toLowerCase() ||
        normalizeHandle(c.handle ?? "") === handleNorm ||
        normalizeHandle(c.name ?? "") === handleNorm
    ) ?? null
  return found ?? undefined
}
