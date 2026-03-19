"use client"

import { Badge } from "@medusajs/ui"
import { clx } from "@medusajs/ui"
import { convertToLocale } from "@lib/util/money"

/** Product tags that trigger a "Save with CODE" badge when no sale price is returned (e.g. cart-level promotions). */
const PROMO_BADGE_TAGS = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROMO_BADGE_TAGS
  ? process.env.NEXT_PUBLIC_PROMO_BADGE_TAGS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["SUMMER15"]) as string[]

export type SavingsBadgePrice = {
  price_type: string
  percentage_diff: string | number
  original_price_number?: number
  calculated_price_number?: number
  currency_code?: string
}

/** Product with optional tags (array of { value: string } or string). */
type ProductWithTags = { tags?: Array<{ value?: string } | string> | null } | null

function getProductPromoTag(product: ProductWithTags): string | null {
  if (!product?.tags?.length) return null
  for (const tag of product.tags) {
    const value = typeof tag === "string" ? tag : (tag as { value?: string }).value
    if (value && PROMO_BADGE_TAGS.includes(value)) return value
  }
  return null
}

type SavingsBadgeProps = {
  /** Price info from getProductPrice. Badge shows when price_type === "sale" or when product has a promo tag. */
  price: SavingsBadgePrice | null | undefined
  /** Optional product for tag-based badge (e.g. SUMMER15) when promotion applies at checkout only. */
  product?: ProductWithTags
  /** Compact for PLP cards; default for PDP. */
  variant?: "compact" | "default"
  /** Optional class for the wrapper (e.g. absolute positioning on PLP). */
  className?: string
}

export default function SavingsBadge({ price, product, variant = "default", className }: SavingsBadgeProps) {
  const promoTag = getProductPromoTag(product ?? null)
  const isSale = price && price.price_type === "sale"

  if (!isSale && !promoTag) {
    return null
  }

  const isCompact = variant === "compact"

  if (promoTag && !isSale) {
    return (
      <Badge
        className={clx(
          "font-semibold bg-ui-tag-green-bg text-ui-tag-green-text border-0",
          isCompact ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-1",
          className
        )}
        data-testid="savings-badge"
      >
        Save with {promoTag}
      </Badge>
    )
  }

  const pct = typeof price!.percentage_diff === "number"
    ? String(price!.percentage_diff)
    : price!.percentage_diff ?? "0"
  const hasDollarSavings =
    price!.original_price_number != null &&
    price!.calculated_price_number != null &&
    price!.currency_code &&
    price!.original_price_number > price!.calculated_price_number
  const dollarSavings = hasDollarSavings
    ? convertToLocale({
        amount: price!.original_price_number! - price!.calculated_price_number!,
        currency_code: price!.currency_code!,
        fromMinorUnit: true,
      })
    : null

  return (
    <Badge
      className={clx(
        "font-semibold bg-ui-tag-green-bg text-ui-tag-green-text border-0",
        isCompact ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-1",
        className
      )}
      data-testid="savings-badge"
    >
      Save {pct}%
      {!isCompact && dollarSavings && (
        <span className="ml-1 opacity-90">({dollarSavings})</span>
      )}
    </Badge>
  )
}
