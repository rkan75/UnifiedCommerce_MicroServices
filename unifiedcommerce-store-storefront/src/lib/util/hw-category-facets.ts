/**
 * Category handles prefixed with `hw_` (Health & Wellness–style sub-facets).
 * Shown nested under non-`hw_` departments on the PLP; still hidden from category page child links.
 */
export function isHwPrefixedCategoryHandle(handle: string | null | undefined): boolean {
  return (handle ?? "").toLowerCase().startsWith("hw_")
}
