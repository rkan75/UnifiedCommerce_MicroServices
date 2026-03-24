import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import SavingsBadge from "@modules/common/components/savings-badge"

export default function ProductPrice({
  product,
  variant,
  layout = "default",
  showSavingsBadge = true,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  layout?: "default" | "pdp"
  showSavingsBadge?: boolean
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  const unitLabel =
    typeof product.metadata === "object" &&
    product.metadata &&
    typeof (product.metadata as Record<string, unknown>).unit_price_label === "string"
      ? String((product.metadata as Record<string, unknown>).unit_price_label).trim()
      : ""

  if (!selectedPrice) {
    return <div className="block h-10 w-40 max-w-full animate-pulse bg-gray-100" />
  }

  const isPdp = layout === "pdp"

  return (
    <div className={clx("flex flex-col gap-2 text-ui-fg-base", isPdp && "gap-1")}>
      {showSavingsBadge ? (
        <SavingsBadge
          price={selectedPrice}
          product={product as { tags?: Array<{ value?: string } | string> }}
          variant="default"
        />
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={clx({
            "text-xl-semi": !isPdp,
            "text-3xl font-bold tracking-tight": isPdp,
            "text-ui-fg-interactive": selectedPrice.price_type === "sale",
          })}
        >
          {!variant && !isPdp && "From "}
          <span
            data-testid="product-price"
            data-value={selectedPrice.calculated_price_number}
          >
            {selectedPrice.calculated_price}
          </span>
        </span>
        {unitLabel ? (
          <span className="text-sm text-ui-fg-subtle">{unitLabel}</span>
        ) : null}
      </div>
      {selectedPrice.price_type === "sale" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ui-fg-subtle">Original: </span>
          <span
            className="line-through text-ui-fg-muted"
            data-testid="original-product-price"
            data-value={selectedPrice.original_price_number}
          >
            {selectedPrice.original_price}
          </span>
          <span className="font-medium text-ui-fg-interactive">
            -{selectedPrice.percentage_diff}%
          </span>
        </div>
      )}
    </div>
  )
}
