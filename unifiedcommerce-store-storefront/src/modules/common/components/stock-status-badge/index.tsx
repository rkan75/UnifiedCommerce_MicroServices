"use client"

import { Badge } from "@medusajs/ui"
import { clx } from "@medusajs/ui"
import { getStockStatus, type StockStatus, type VariantWithInventory } from "@lib/util/get-stock-status"

const LABELS: Record<Exclude<StockStatus, null>, string> = {
  backorder: "Backorder",
  out_of_stock: "Out of Stock",
  low_stock: "Low Stock",
  more_stock: "More Stock",
  in_stock: "In Stock",
}

const STYLES: Record<Exclude<StockStatus, null>, string> = {
  backorder: "bg-ui-tag-orange-bg text-ui-tag-orange-text border-0",
  out_of_stock: "bg-ui-tag-red-bg text-ui-tag-red-text border-0",
  low_stock: "bg-ui-tag-amber-bg text-ui-tag-amber-text border-0",
  more_stock: "bg-header-red text-white border-0",
  in_stock: "bg-ui-tag-green-bg text-ui-tag-green-text border-0",
}

type StockStatusBadgeProps = {
  variant: VariantWithInventory | null | undefined
  /** Compact for PLP cards; default for PDP */
  variantStyle?: "compact" | "default"
  className?: string
}

export default function StockStatusBadge({
  variant,
  variantStyle = "default",
  className,
}: StockStatusBadgeProps) {
  const status = getStockStatus(variant)
  if (!status) return null

  const label = LABELS[status]
  const style = STYLES[status]
  const isCompact = variantStyle === "compact"

  return (
    <Badge
      className={clx(
        "font-semibold border-0",
        style,
        isCompact ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-1",
        className
      )}
      data-testid="stock-status-badge"
    >
      {label}
    </Badge>
  )
}
