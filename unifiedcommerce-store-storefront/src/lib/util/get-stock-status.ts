/**
 * Stock status for display badges.
 * Rules: qty <= 0 + backorder → Backorder; qty <= 0 → Out of Stock; 1..99 → Low Stock; 100+ → More Stock.
 * When manage_inventory is false, returns "in_stock".
 *
 * Note: Only zero (or negative) quantity is "out_of_stock". Small positive counts must not be labeled OOS.
 */
export type StockStatus =
  | "backorder"
  | "out_of_stock"
  | "low_stock"
  | "more_stock"
  | "in_stock"

export type VariantWithInventory = {
  manage_inventory?: boolean
  allow_backorder?: boolean
  inventory_quantity?: number | null
}

/** Inclusive: positive qty up to this shows "Low Stock"; above shows "More Stock". */
const LOW_STOCK_MAX = 99

export function getStockStatus(
  variant: VariantWithInventory | null | undefined
): StockStatus | null {
  if (!variant) return null

  if (!variant.manage_inventory) {
    return "in_stock"
  }

  const qty = variant.inventory_quantity ?? 0

  if (qty <= 0) {
    return variant.allow_backorder ? "backorder" : "out_of_stock"
  }

  if (qty <= LOW_STOCK_MAX) return "low_stock"
  return "more_stock"
}
