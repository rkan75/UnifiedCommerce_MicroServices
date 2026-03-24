import { HttpTypes } from "@medusajs/types"

import { isHwPrefixedCategoryHandle } from "@lib/util/hw-category-facets"

/** Walk the category tree without duplicating nodes (guards against repeated ids). */
export function flattenCategoryTree(
  roots: HttpTypes.StoreProductCategory[]
): HttpTypes.StoreProductCategory[] {
  const out: HttpTypes.StoreProductCategory[] = []
  const seen = new Set<string>()
  const walk = (nodes: HttpTypes.StoreProductCategory[]) => {
    for (const n of nodes) {
      if (!n?.id || seen.has(n.id)) continue
      seen.add(n.id)
      out.push(n)
      if (n.category_children?.length) walk(n.category_children)
    }
  }
  walk(roots ?? [])
  return out
}

function isFacetRootInLoadedTree(
  c: HttpTypes.StoreProductCategory,
  idSet: Set<string | undefined>
): boolean {
  return !!c.handle && (!c.parent_category?.id || !idSet.has(c.parent_category.id))
}

/** Every `hw_*` descendant under `parent` (any depth), sorted by name. */
export function hwSubcategoriesUnderDepartment(
  parent: HttpTypes.StoreProductCategory
): HttpTypes.StoreProductCategory[] {
  const out: HttpTypes.StoreProductCategory[] = []
  const walk = (nodes: HttpTypes.StoreProductCategory[]) => {
    for (const n of nodes ?? []) {
      if (n?.handle && isHwPrefixedCategoryHandle(n.handle)) {
        out.push(n)
      }
      if (n?.category_children?.length) walk(n.category_children)
    }
  }
  walk(parent.category_children ?? [])
  out.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }))
  return out
}

export type DepartmentFacetEntry = {
  department: HttpTypes.StoreProductCategory
  hwSubcategories: HttpTypes.StoreProductCategory[]
}

/**
 * PLP department facet rows: each non-`hw_*` tree root, plus `hw_*` subcategories nested under it.
 * `hw_*` categories that are roots in the loaded tree (no in-tree parent) appear as their own row
 * with no nested subs.
 */
export function departmentFacetEntries(
  categories: HttpTypes.StoreProductCategory[]
): DepartmentFacetEntry[] {
  const flat = flattenCategoryTree(categories ?? [])
  const idSet = new Set(flat.map((c) => c.id))

  const nonHwRoots = flat
    .filter(
      (c) =>
        isFacetRootInLoadedTree(c, idSet) && !isHwPrefixedCategoryHandle(c.handle)
    )
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }))

  const entries: DepartmentFacetEntry[] = nonHwRoots.map((department) => ({
    department,
    hwSubcategories: hwSubcategoriesUnderDepartment(department),
  }))

  const orphanHwRoots = flat
    .filter((c) => isFacetRootInLoadedTree(c, idSet) && isHwPrefixedCategoryHandle(c.handle))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }))

  for (const department of orphanHwRoots) {
    entries.push({ department, hwSubcategories: [] })
  }

  return entries
}

/**
 * Top-level department rows only (no nested `hw_*` list). Order matches {@link departmentFacetEntries}.
 */
export function departmentFacetRoots(
  categories: HttpTypes.StoreProductCategory[]
): HttpTypes.StoreProductCategory[] {
  return departmentFacetEntries(categories).map((e) => e.department)
}

export function findCategoryInTree(
  categories: HttpTypes.StoreProductCategory[],
  categoryId: string | undefined | null
): HttpTypes.StoreProductCategory | undefined {
  if (!categoryId) return undefined
  return flattenCategoryTree(categories ?? []).find((c) => c.id === categoryId)
}
