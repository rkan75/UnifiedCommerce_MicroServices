"use client"

import { useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { Button, Text, clx } from "@medusajs/ui"
import { ShoppingCart } from "@medusajs/icons"

import { addToCart } from "@lib/data/cart"
import {
  dispatchCartUpdated,
  useCartActions,
} from "@modules/common/components/cart-provider"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SavingsBadge from "@modules/common/components/savings-badge"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import { shouldUseUnoptimizedProductImage } from "@modules/products/components/thumbnail"
import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"
import { getProductPrice } from "@lib/util/get-product-price"

export type CarouselCardLabels = {
  addToCart: string
  moreStock: string
  inStock: string
  outOfStock: string
  categoryFallback: string
}

function productImageUrl(product: HttpTypes.StoreProduct): string | null {
  const thumb = product.thumbnail
  if (thumb) return thumb
  const img = product.images?.[0]?.url
  return img ?? null
}

function categoryLabel(
  product: HttpTypes.StoreProduct,
  fallback: string
): string {
  const cats = product.categories as
    | Array<{ name?: string | null }>
    | undefined
  const name = cats?.[0]?.name?.trim()
  if (name) return name.toUpperCase()
  const meta = product.metadata as Record<string, unknown> | null | undefined
  const fromMeta = meta?.category_label ?? meta?.category
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim().toUpperCase()
  }
  return fallback.toUpperCase()
}

function variantInStock(v: HttpTypes.StoreProductVariant | undefined): boolean {
  if (!v) return false
  if (!v.manage_inventory) return true
  if (v.allow_backorder) return true
  return (v.inventory_quantity ?? 0) > 0
}

type CarouselProductCardProps = {
  product: HttpTypes.StoreProduct
  labels: CarouselCardLabels
  /** Shown on the CTA while add-to-cart is in flight */
  addingLabel?: string
}

export default function CarouselProductCard({
  product,
  labels,
  addingLabel = "…",
}: CarouselProductCardProps) {
  const params = useParams()
  const countryCode = (params?.countryCode as string) || "us"
  const cartActions = useCartActions()
  const refetchCart = cartActions?.refetchCart

  const [isAdding, setIsAdding] = useState(false)
  const listLabels = useShopInStoreListLabels()

  const handle = product.handle
  const src = productImageUrl(product)
  const firstVariant = product.variants?.[0]
  const firstVariantId = firstVariant?.id
  const canAdd = Boolean(firstVariantId && variantInStock(firstVariant))

  let cheapestPrice: ReturnType<typeof getProductPrice>["cheapestPrice"] = null
  try {
    ;({ cheapestPrice } = getProductPrice({ product }))
  } catch {
    cheapestPrice = null
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!firstVariantId || !canAdd) return

    setIsAdding(true)
    try {
      await addToCart({
        variantId: firstVariantId,
        quantity: 1,
        countryCode,
      })
      if (refetchCart) await refetchCart()
      dispatchCartUpdated()
    } catch (error) {
      console.error("Failed to add to cart:", error)
    } finally {
      setIsAdding(false)
    }
  }

  if (!handle) return null

  const cat = categoryLabel(product, labels.categoryFallback)

  return (
    <article
      data-carousel-card
      className="w-full shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-ui-border-base bg-white transition-shadow hover:shadow-lg">
        <LocalizedClientLink
          href={`/products/${handle}`}
          className="flex flex-1 flex-col"
        >
          <div className="relative overflow-hidden bg-white px-3 pb-2 pt-4">
            {cheapestPrice?.price_type === "sale" ||
            (product as { tags?: unknown[] })?.tags?.length ||
            product.variants?.[0] ? (
              <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
                {cheapestPrice?.price_type === "sale" ||
                (product as { tags?: unknown[] })?.tags?.length ? (
                  <SavingsBadge
                    price={cheapestPrice}
                    product={
                      product as {
                        tags?: Array<{ value?: string } | string>
                      }
                    }
                    variant="compact"
                  />
                ) : null}
                <StockStatusBadge
                  variant={
                    product.variants?.[0] as {
                      manage_inventory?: boolean
                      allow_backorder?: boolean
                      inventory_quantity?: number
                    }
                  }
                  variantStyle="compact"
                />
              </div>
            ) : null}
            <div className="relative aspect-square w-full">
              {src ? (
                <Image
                  src={src}
                  alt={product.title ?? "Product"}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-contain object-center p-4 transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                  unoptimized={shouldUseUnoptimizedProductImage(src)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-ui-fg-muted">
                  —
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
              {cat}
            </div>
            <h3 className="mb-2 line-clamp-2 text-base font-semibold text-ui-fg-base group-hover:text-ui-fg-base">
              {product.title}
            </h3>
            {cheapestPrice ? (
              <div className="mt-auto flex items-center gap-2 pt-2">
                {cheapestPrice.price_type === "sale" && (
                  <Text className="text-sm text-ui-fg-muted line-through">
                    {cheapestPrice.original_price}
                  </Text>
                )}
                <Text
                  className={clx("font-semibold text-ui-fg-muted", {
                    "text-ui-fg-interactive":
                      cheapestPrice.price_type === "sale",
                  })}
                >
                  {cheapestPrice.calculated_price}
                </Text>
              </div>
            ) : null}
          </div>
        </LocalizedClientLink>

        <div className="px-4 pb-4">
          <Button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding || !canAdd}
            variant="primary"
            className={clx("w-full", PRIMARY_ADD_TO_CART_BUTTON_CLASS)}
            isLoading={isAdding}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isAdding
              ? addingLabel
              : listLabels.isShopInStoreList
                ? listLabels.addToCartTitleCase
                : labels.addToCart}
          </Button>
        </div>
      </div>
    </article>
  )
}
