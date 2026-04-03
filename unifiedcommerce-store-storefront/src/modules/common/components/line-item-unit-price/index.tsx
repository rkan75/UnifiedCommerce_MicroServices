import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

type LineItemUnitPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  currencyCode: string
}

const LineItemUnitPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemUnitPriceProps) => {
  const { total, original_total } = item
  const totalAmt = total ?? 0
  const originalAmt = original_total ?? 0
  const qty = item.quantity && item.quantity > 0 ? item.quantity : 1
  const hasReducedPrice = totalAmt < originalAmt

  const percentage_diff =
    originalAmt > 0
      ? Math.round(((originalAmt - totalAmt) / originalAmt) * 100)
      : 0

  return (
    <div className="flex flex-col text-ui-fg-muted justify-center h-full">
      {hasReducedPrice && (
        <>
          <p>
            {style === "default" && (
              <span className="text-ui-fg-muted">Original: </span>
            )}
            <span
              className="line-through"
              data-testid="product-unit-original-price"
            >
              {convertToLocale({
                amount: originalAmt / qty,
                currency_code: currencyCode,
                fromMinorUnit: true,
              })}
            </span>
          </p>
          {style === "default" && (
            <span className="text-ui-fg-interactive">-{percentage_diff}%</span>
          )}
        </>
      )}
      <span
        className={clx("text-base-regular", {
          "text-ui-fg-interactive": hasReducedPrice,
        })}
        data-testid="product-unit-price"
      >
        {convertToLocale({
          amount: totalAmt / qty,
          currency_code: currencyCode,
          fromMinorUnit: true,
        })}
      </span>
    </div>
  )
}

export default LineItemUnitPrice
