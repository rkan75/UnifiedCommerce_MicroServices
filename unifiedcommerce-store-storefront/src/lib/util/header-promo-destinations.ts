import { HttpTypes } from "@medusajs/types"

import { flattenCategoryTree } from "@lib/util/plp-department-categories"

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export type CategoryPromoMatchers = {
  matchHandles: string[]
  matchNameKeywords?: string[]
  fallbackHref: string
}

function categoryMatches(
  cat: HttpTypes.StoreProductCategory,
  m: CategoryPromoMatchers
): boolean {
  const h = normalizeKey(cat.handle ?? "")
  const name = normalizeKey(cat.name ?? "")
  for (const alias of m.matchHandles) {
    const a = normalizeKey(alias)
    if (!a) continue
    if (h === a || h.includes(a) || a.includes(h)) return true
  }
  if (m.matchNameKeywords?.length) {
    for (const kw of m.matchNameKeywords) {
      const k = normalizeKey(kw)
      if (name.includes(k) || h.includes(k)) return true
    }
  }
  return false
}

function categoryDepth(cat: HttpTypes.StoreProductCategory): number {
  let d = 0
  let p = cat.parent_category
  while (p) {
    d++
    p = p.parent_category
  }
  return d
}

/** Path segment for `/categories/...` (nested handles joined with `/`). */
function categoryPathFromRoot(cat: HttpTypes.StoreProductCategory): string {
  const segs: string[] = []
  let c: HttpTypes.StoreProductCategory | undefined = cat
  while (c) {
    if (c.handle) segs.unshift(c.handle)
    c = c.parent_category as HttpTypes.StoreProductCategory | undefined
  }
  return segs.map((s) => encodeURIComponent(s)).join("/")
}

/**
 * First matching category in the tree (shallowest wins), else `fallbackHref`.
 */
export function resolvePromoCategoryHref(
  categories: HttpTypes.StoreProductCategory[],
  m: CategoryPromoMatchers
): string {
  const flat = flattenCategoryTree(categories ?? []).filter((c) => c.handle)
  const hits = flat.filter((c) => categoryMatches(c, m))
  if (!hits.length) return m.fallbackHref
  hits.sort((a, b) => categoryDepth(a) - categoryDepth(b))
  const path = categoryPathFromRoot(hits[0]!)
  return path ? `/categories/${path}` : m.fallbackHref
}

const BEST_SELLERS: CategoryPromoMatchers = {
  matchHandles: [
    "best-sellers",
    "best-seller",
    "bestsellers",
    "bestseller",
    "top-sellers",
    "top-seller",
    "best-selling",
  ],
  matchNameKeywords: ["best seller", "bestseller", "top seller"],
  fallbackHref: "/store",
}

const NEW_ON_THE_DROP: CategoryPromoMatchers = {
  matchHandles: [
    "new-on-the-drop",
    "new-on-drop",
    "new-arrivals",
    "new-arrival",
    "the-drop",
    "drop",
    "new-drop",
  ],
  matchNameKeywords: ["new on the drop", "the drop", "new arrival"],
  fallbackHref: "/store?sortBy=created_at",
}

const CREATINE: CategoryPromoMatchers = {
  matchHandles: ["creatine"],
  matchNameKeywords: ["creatine"],
  fallbackHref: "/store?q=creatine",
}

const LIVE_WELL_SALE: CategoryPromoMatchers = {
  matchHandles: [
    "live-well-sale",
    "live-well",
    "livewell-sale",
    "livewell",
    "march-sale",
    "march-lws",
    "lws",
  ],
  matchNameKeywords: [
    "live well sale",
    "live well",
    "march sale",
    "livewell",
  ],
  fallbackHref: "/store",
}

/** Collection handle aliases → `/store?collection_id=…` */
const GHOST_COLLECTION_HANDLES = ["ghost", "ghost-lifestyle", "ghost-bogo"]

export function resolvePromoCollectionStoreHref(
  collections: HttpTypes.StoreCollection[],
  matchHandles: string[],
  fallbackHref: string
): string {
  for (const col of collections ?? []) {
    if (!col?.id || !col.handle) continue
    const h = normalizeKey(col.handle)
    for (const alias of matchHandles) {
      const a = normalizeKey(alias)
      if (!a) continue
      if (h === a || h.includes(a) || a.includes(h)) {
        return `/store?collection_id=${encodeURIComponent(col.id)}`
      }
    }
  }
  return fallbackHref
}

export type HeaderPromoDestinations = {
  bestSellers: string
  newOnTheDrop: string
  creatine: string
  ghostCollection: string
  liveWellSale: string
}

export function resolveHeaderPromoDestinations(
  categories: HttpTypes.StoreProductCategory[],
  collections: HttpTypes.StoreCollection[]
): HeaderPromoDestinations {
  return {
    bestSellers: resolvePromoCategoryHref(categories, BEST_SELLERS),
    newOnTheDrop: resolvePromoCategoryHref(categories, NEW_ON_THE_DROP),
    creatine: resolvePromoCategoryHref(categories, CREATINE),
    ghostCollection: resolvePromoCollectionStoreHref(
      collections,
      GHOST_COLLECTION_HANDLES,
      "/store"
    ),
    liveWellSale: resolvePromoCategoryHref(categories, LIVE_WELL_SALE),
  }
}
