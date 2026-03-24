import type { HttpTypes } from "@medusajs/types"

export function departmentGroupLabelForLineItem(
  item: HttpTypes.StoreCartLineItem
): string {
  const product = (
    item as { variant?: { product?: { categories?: Array<{ name?: string | null }> } } }
  ).variant?.product
  const names =
    product?.categories
      ?.map((c) => c.name?.trim())
      .filter((n): n is string => Boolean(n && n.length)) ?? []
  if (names.length) return names.join(" > ")
  return "Other"
}

export function locationGroupLabelForLineItem(
  item: HttpTypes.StoreCartLineItem
): string {
  const lineMeta = item.metadata as Record<string, unknown> | undefined
  const product = (
    item as { variant?: { product?: { metadata?: Record<string, unknown> } } }
  ).variant?.product
  const fromLine =
    lineMeta?.list_location ??
    lineMeta?.in_store_location ??
    lineMeta?.store_location
  if (typeof fromLine === "string" && fromLine.trim()) return fromLine.trim()
  const pm = product?.metadata
  const fromProduct =
    pm?.in_store_location ?? pm?.store_aisle ?? pm?.list_location
  if (typeof fromProduct === "string" && fromProduct.trim()) {
    return fromProduct.trim()
  }
  return "In-store"
}

export function groupCartItemsByKey(
  items: HttpTypes.StoreCartLineItem[] | undefined,
  mode: "department" | "location"
): { key: string; items: HttpTypes.StoreCartLineItem[] }[] {
  if (!items?.length) return []
  const keyFn =
    mode === "department"
      ? departmentGroupLabelForLineItem
      : locationGroupLabelForLineItem
  const map = new Map<string, HttpTypes.StoreCartLineItem[]>()
  for (const item of items) {
    const k = keyFn(item)
    const list = map.get(k) ?? []
    list.push(item)
    map.set(k, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, group]) => ({
      key,
      items: group.sort(
        (x: HttpTypes.StoreCartLineItem, y: HttpTypes.StoreCartLineItem) =>
          (x.created_at ?? "") < (y.created_at ?? "") ? 1 : -1
      ),
    }))
}
