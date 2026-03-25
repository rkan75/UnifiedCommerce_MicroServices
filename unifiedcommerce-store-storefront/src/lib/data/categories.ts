"use server"

import {
  getCategoriesServiceBaseUrl,
  getMedusaPublishableKeyHeaders,
} from "@lib/config/products-service"
import { HttpTypes } from "@medusajs/types"
import { getCachedStorefrontCategoryIdSet } from "./catalog-scope"
import { STORE_CATEGORIES_CACHE_TAG } from "./cache-tags"
import { resolveStorefrontProductTypeId } from "./storefront-product-type-id"

const CATEGORIES_REVALIDATE =
  typeof process.env.NEXT_CATEGORIES_REVALIDATE_SECONDS !== "undefined"
    ? Number(process.env.NEXT_CATEGORIES_REVALIDATE_SECONDS)
    : 300

type CategoryNode = HttpTypes.StoreProductCategory & {
  parent_category_id?: string | null
  category_children?: HttpTypes.StoreProductCategory[]
}

/**
 * Java categories-service returns a flat list; storefront nav expects a tree (category_children).
 */
function nestCategoriesFlat(
  flat: HttpTypes.StoreProductCategory[]
): HttpTypes.StoreProductCategory[] {
  if (!flat?.length) return []
  const nodes = new Map<string, CategoryNode>()
  for (const c of flat) {
    const id = c.id
    if (!id) continue
    nodes.set(id, { ...c, category_children: [] })
  }
  const roots: HttpTypes.StoreProductCategory[] = []
  for (const c of flat) {
    const id = c.id
    if (!id || !nodes.has(id)) continue
    const node = nodes.get(id)!
    const pid =
      (c as CategoryNode).parent_category_id ?? c.parent_category?.id ?? null
    if (pid && nodes.has(pid)) {
      const parent = nodes.get(pid)!
      if (!parent.category_children) parent.category_children = []
      parent.category_children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (list: HttpTypes.StoreProductCategory[]) => {
    list.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      })
    )
    for (const x of list) {
      const ch = (x as CategoryNode).category_children
      if (ch?.length) sortRec(ch)
    }
  }
  sortRec(roots)
  return roots
}

async function fetchProductCategoriesFlat(limit: number): Promise<
  HttpTypes.StoreProductCategory[]
> {
  const base = getCategoriesServiceBaseUrl()
  const sp = new URLSearchParams()
  sp.set("limit", String(Math.min(500, Math.max(1, limit))))
  const url = `${base}/store/product-categories?${sp.toString()}`
  const res = await fetch(url, {
    method: "GET",
    headers: getMedusaPublishableKeyHeaders(),
    next: {
      revalidate: CATEGORIES_REVALIDATE,
      tags: [STORE_CATEGORIES_CACHE_TAG],
    },
    cache: "force-cache",
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(
      `categories-service GET /store/product-categories failed: ${res.status} ${t.slice(0, 200)}`
    )
  }
  const data = (await res.json()) as {
    product_categories?: HttpTypes.StoreProductCategory[]
  }
  return data.product_categories ?? []
}

export const listCategories = async (
  query?: Record<string, unknown>,
  /** When storefront product type is configured (id or value env), categories with no in-scope products are removed. */
  countryCode?: string
) => {
  const limit =
    typeof query?.limit === "number"
      ? query.limit
      : Number(query?.limit) || 100

  const flat = await fetchProductCategoriesFlat(limit)
  const nested = nestCategoriesFlat(flat)
  return filterCategoriesByStorefrontProductType(nested, countryCode)
}

function filterCategoryNode(
  cat: HttpTypes.StoreProductCategory,
  allowed: Set<string>
): HttpTypes.StoreProductCategory | null {
  const rawChildren = cat.category_children ?? []
  const nextChildren = rawChildren
    .map((ch) => filterCategoryNode(ch, allowed))
    .filter((x): x is HttpTypes.StoreProductCategory => x != null)
  const keepSelf = cat.id ? allowed.has(cat.id) : false
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
  const allowed = await getCachedStorefrontCategoryIdSet(countryCode, typeId)
  return categories
    .map((c) => filterCategoryNode(c, allowed))
    .filter((x): x is HttpTypes.StoreProductCategory => x != null)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

function normalizeHandle(h: string): string {
  const s = slugify(h).replace(/-and-/g, "-")
  return s.replace(/-+/g, "-")
}

function categoryMatchesSegment(
  c: HttpTypes.StoreProductCategory,
  segment: string
): boolean {
  const normSeg = normalizeHandle(segment)
  return (
    (c.handle ?? "").toLowerCase() === segment.toLowerCase() ||
    normalizeHandle(c.handle ?? "") === normSeg ||
    normalizeHandle(c.name ?? "") === normSeg
  )
}

function findCategoryByPath(
  roots: HttpTypes.StoreProductCategory[],
  segments: string[]
): HttpTypes.StoreProductCategory | undefined {
  if (!segments.length) return undefined
  let level: HttpTypes.StoreProductCategory[] = roots
  let found: HttpTypes.StoreProductCategory | undefined
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    found = level.find((c) => categoryMatchesSegment(c, seg))
    if (!found) return undefined
    if (i === segments.length - 1) return found
    level = found.category_children ?? []
  }
  return found
}

function findCategoryFlatFallback(
  roots: HttpTypes.StoreProductCategory[],
  handleNorm: string,
  rawLower: string
): HttpTypes.StoreProductCategory | undefined {
  const walk = (
    cats: HttpTypes.StoreProductCategory[]
  ): HttpTypes.StoreProductCategory | undefined => {
    for (const c of cats) {
      if (
        c.handle?.toLowerCase() === rawLower ||
        normalizeHandle(c.handle ?? "") === handleNorm ||
        normalizeHandle(c.name ?? "") === handleNorm
      ) {
        return c
      }
      const sub = walk(c.category_children ?? [])
      if (sub) return sub
    }
    return undefined
  }
  return walk(roots)
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

  const segments = handle.split("/").map((s) => s.trim()).filter(Boolean)

  const resolveInTree = (
    roots: HttpTypes.StoreProductCategory[]
  ): HttpTypes.StoreProductCategory | undefined => {
    const byPath = findCategoryByPath(roots, segments)
    if (byPath) return byPath
    const handleNorm = normalizeHandle(handle)
    return findCategoryFlatFallback(roots, handleNorm, handle.toLowerCase())
  }

  const filtered = await listCategories({ limit: 500 }, countryCode)
  const fromFiltered = resolveInTree(filtered)
  if (fromFiltered) return fromFiltered

  /** Category may exist in DB but be omitted from storefront-type-filtered tree (e.g. Best Sellers) */
  if (countryCode?.trim()) {
    const unfiltered = await listCategories({ limit: 500 })
    return resolveInTree(unfiltered)
  }

  return undefined
}
