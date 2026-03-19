"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Text, Input } from "@medusajs/ui"
import { addToCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Thumbnail from "@modules/products/components/thumbnail"
import { ShoppingCart } from "@medusajs/icons"
import { convertToLocale } from "@lib/util/money"

/** Currencies that use 2 decimal places (e.g. USD: 1000 = $10.00). Others (JPY, KRW) use 1. */
const MINOR_UNIT_DIVISORS: Record<string, number> = {
  usd: 100,
  eur: 100,
  gbp: 100,
  cad: 100,
  aud: 100,
  chf: 100,
}

function toDisplayAmount(
  rawAmount: number,
  currencyCode: string
): number {
  const divisor = MINOR_UNIT_DIVISORS[currencyCode.toLowerCase()] ?? 100
  return rawAmount / divisor
}

type GiftCardVariant = HttpTypes.StoreProductVariant

type GiftCardsTemplateProps = {
  products: HttpTypes.StoreProduct[]
  countryCode: string
}

export default function GiftCardsTemplate({
  products,
  countryCode,
}: GiftCardsTemplateProps) {
  const router = useRouter()
  const [addingToCart, setAddingToCart] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const variantCards: Array<{
    product: HttpTypes.StoreProduct
    variant: GiftCardVariant
  }> = []
  for (const product of products) {
    if (!product.variants?.length) continue
    for (const variant of product.variants) {
      variantCards.push({ product, variant })
    }
  }

  const amountInDisplayUnit = (variant: GiftCardVariant) => {
    const raw =
      variant.calculated_price?.calculated_amount ??
      (variant as { calculated_price?: { calculated_amount?: number } })
        ?.calculated_price?.calculated_amount
    const currencyCode = variant.calculated_price?.currency_code ?? "usd"
    return raw != null ? toDisplayAmount(raw, currencyCode) : null
  }

  const totalCount = Object.values(quantities).reduce(
    (sum, q) => sum + Math.max(0, q),
    0
  )
  let totalAmount = 0
  const itemsToAdd: { variantId: string; quantity: number; amount: number }[] = []
  for (const { variant } of variantCards) {
    const qty = Math.max(0, Math.floor(quantities[variant.id!] ?? 0))
    if (qty > 0 && variant.id) {
      const amt = amountInDisplayUnit(variant)
      if (amt != null) {
        totalAmount += amt * qty
        itemsToAdd.push({ variantId: variant.id, quantity: qty, amount: amt })
      }
    }
  }
  const currencyCode =
    variantCards[0]?.variant.calculated_price?.currency_code ?? "usd"

  const handleAddToCartAndCheckout = async (proceedToCheckout: boolean) => {
    if (itemsToAdd.length === 0) return

    setAddingToCart(true)
    try {
      for (const { variantId, quantity } of itemsToAdd) {
        await addToCart({
          variantId,
          quantity,
          countryCode,
        })
      }
      setQuantities({})
      router.refresh()
      if (proceedToCheckout) {
        router.push(`/${countryCode}/checkout`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (
        msg.includes("was not found") ||
        msg.includes("UnrecognizedActionError")
      ) {
        router.refresh()
      } else {
        console.error("Failed to add to cart:", error)
      }
    } finally {
      setAddingToCart(false)
    }
  }

  const updateQuantity = (variantId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(0, Math.min(999, value)),
    }))
  }

  if (products.length === 0) {
    return (
      <div className="content-container py-12">
        <h1 className="text-2xl-semi mb-4">Gift Cards</h1>
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-12 text-center">
          <Text className="text-ui-fg-subtle">
            No gift cards available at the moment. Please check back later.
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="content-container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ui-fg-base mb-2">
          Gift Cards
        </h1>
        <p className="text-ui-fg-subtle text-base max-w-2xl">
          Give the gift of choice. Our gift cards can be used for any purchase
          in the store. Available in $10, $25, $50, and $100 denominations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {variantCards.map(({ product, variant }) => {
          const displayAmount = amountInDisplayUnit(variant)
          const formattedPrice =
            displayAmount != null
              ? convertToLocale({
                  amount: displayAmount,
                  currency_code:
                    variant.calculated_price?.currency_code ?? "usd",
                })
              : variant.title

          const qty = Math.max(0, Math.floor(quantities[variant.id!] ?? 0))

          return (
            <div
              key={variant.id}
              className="group flex flex-col bg-white border border-ui-border-base rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square bg-ui-bg-subtle">
                <Thumbnail
                  thumbnail={variant.thumbnail ?? product.thumbnail}
                  images={variant.images ?? product.images}
                  size="square"
                  className="w-full h-full"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-ui-fg-base mb-1">
                  {product.title}
                </h3>
                <p className="text-lg font-bold text-ui-fg-base mb-2">
                  {variant.title}
                </p>
                <div className="mb-3 font-semibold">{formattedPrice}</div>

                <div className="flex items-center gap-2 mb-4">
                  <label htmlFor={`qty-${variant.id}`} className="text-sm text-ui-fg-subtle">
                    Quantity:
                  </label>
                  <Input
                    id={`qty-${variant.id}`}
                    type="number"
                    min={0}
                    max={999}
                    value={qty}
                    onChange={(e) =>
                      updateQuantity(
                        variant.id!,
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary & actions */}
      <div className="mt-8 p-6 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Text className="text-ui-fg-subtle">
              {totalCount > 0
                ? `${totalCount} gift card${totalCount !== 1 ? "s" : ""} • Total: `
                : "Select quantities above to add gift cards"}
            </Text>
            {totalCount > 0 && (
              <Text className="text-xl font-bold text-ui-fg-base">
                {convertToLocale({
                  amount: totalAmount,
                  currency_code: currencyCode,
                })}
              </Text>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              disabled={itemsToAdd.length === 0 || addingToCart}
              onClick={() => handleAddToCartAndCheckout(false)}
            >
              {addingToCart ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span>
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShoppingCart />
                  Add to Cart
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              disabled={itemsToAdd.length === 0 || addingToCart}
              onClick={() => handleAddToCartAndCheckout(true)}
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
