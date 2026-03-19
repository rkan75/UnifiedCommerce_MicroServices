import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, any>) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
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
    .then(({ product_categories }) => product_categories)
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

export const getCategoryByHandle = async (categoryHandle: string[]) => {
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

  const all = await listCategories({ limit: 500 })
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
