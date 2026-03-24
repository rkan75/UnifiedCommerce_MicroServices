"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { Text, Button } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { addToCart, updateLineItem, deleteLineItem } from "@lib/data/cart"
import { useCart, useCartActions, dispatchCartUpdated } from "@modules/common/components/cart-provider"
import AddToWishlistButton from "@modules/common/components/add-to-wishlist-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import SavingsBadge from "@modules/common/components/savings-badge"
import StockStatusBadge from "@modules/common/components/stock-status-badge"
import { ShoppingCart, Minus, Plus } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import React from "react"
import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"

function ProductPreviewComponent({
  product,
  isFeatured,
  region,
  cart: cartProp,
  imageFit,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  cart?: HttpTypes.StoreCart | null
  /** Use `contain` on PDP related products so images fit in the frame without cropping. */
  imageFit?: "cover" | "contain"
}) {
  const params = useParams()
  const countryCode = (params?.countryCode as string) || "us"
  
  // Get cart actions (and fallback to useCart if actions not available)
  const cartActions = useCartActions()
  const cartContext = useCart()
  
  // When cart is passed (e.g. from product list), use it only — context updates then won't re-render the list (no flicker)
  const cart = cartProp !== undefined ? (cartProp ?? null) : (cartContext?.cart ?? null)
  const refetchCart = cartActions?.refetchCart ?? cartContext?.refetchCart

  const [isAdding, setIsAdding] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  /** Optimistic quantity so UI updates immediately without page refresh */
  const [optimisticQty, setOptimisticQty] = useState<number | null>(null)
  /** After first add we get lineItemId from refetch; avoid depending on context cart so list doesn't flicker */
  const [localLineItemId, setLocalLineItemId] = useState<string | null>(null)
  const listLabels = useShopInStoreListLabels()

  const { cheapestPrice } = getProductPrice({
    product,
  })
  const firstVariantId = product.variants?.[0]?.id
  const firstVariant = product.variants?.[0]

  const cartItem = useMemo(() => {
    if (!cart?.items || !firstVariantId) return null
    return cart.items.find(
      (item: { variant_id?: string; variant?: { id?: string } }) =>
        item.variant_id === firstVariantId || item.variant?.id === firstVariantId
    )
  }, [cart?.items, firstVariantId])

  const serverQuantity = cartItem?.quantity || 0
  const lineItemId = localLineItemId ?? cartItem?.id
  const currentQuantity = optimisticQty !== null ? optimisticQty : serverQuantity
  const isInCart = currentQuantity > 0

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!firstVariantId || !firstVariant) return

    setIsAdding(true)
    setOptimisticQty(1)
    try {
      await addToCart({
        variantId: firstVariantId,
        quantity: 1,
        countryCode,
      })
      // Refresh context first so mini-cart updates; then notify any other listeners
      const findItem = (c: { items?: Array<{ id?: string; variant_id?: string; variant?: { id?: string } }> } | null) =>
        c?.items?.find(
          (i) => i.variant_id === firstVariantId || i.variant?.id === firstVariantId
        )
      if (refetchCart) {
        let newCart = await refetchCart()
        let item = findItem(newCart ?? null)
        if (!item?.id) {
          await new Promise((r) => setTimeout(r, 250))
          newCart = await refetchCart()
          item = findItem(newCart ?? null)
        }
        if (item?.id) setLocalLineItemId(item.id)
      }
      dispatchCartUpdated()
    } catch (error) {
      setOptimisticQty(null)
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        dispatchCartUpdated()
      } else {
        console.error("Failed to add to cart:", error)
      }
    } finally {
      setIsAdding(false)
    }
  }

  const handleIncreaseQuantity = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!lineItemId) {
      await handleAddToCart(e)
      return
    }

    const nextQty = currentQuantity + 1
    setOptimisticQty(nextQty)
    setIsUpdating(true)
    try {
      await updateLineItem({
        lineId: lineItemId,
        quantity: nextQty,
      })
      if (refetchCart) await refetchCart()
      dispatchCartUpdated()
    } catch (error) {
      setOptimisticQty(null)
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        if (refetchCart) await refetchCart()
        dispatchCartUpdated()
      } else {
        console.error("Failed to update cart:", error)
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDecreaseQuantity = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!lineItemId) return

    const nextQty = currentQuantity - 1
    setOptimisticQty(nextQty <= 0 ? 0 : nextQty)
    setIsUpdating(true)
    try {
      if (currentQuantity <= 1) {
        await deleteLineItem(lineItemId)
        setLocalLineItemId(null)
      } else {
        await updateLineItem({
          lineId: lineItemId,
          quantity: nextQty,
        })
      }
      if (refetchCart) await refetchCart()
      dispatchCartUpdated()
    } catch (error) {
      setOptimisticQty(null)
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
        if (refetchCart) await refetchCart()
        dispatchCartUpdated()
      } else {
        console.error("Failed to update cart:", error)
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const variantHasInventory = (v: HttpTypes.StoreProductVariant): boolean => {
    if (!v.manage_inventory) return true
    if (v.allow_backorder) return true
    return (v.inventory_quantity ?? 0) > 0
  }

  const hasInventory = firstVariant ? variantHasInventory(firstVariant) : false

  // Clear optimistic state when server cart catches up
  useEffect(() => {
    if (optimisticQty !== null && serverQuantity === optimisticQty) {
      setOptimisticQty(null)
    }
  }, [serverQuantity, optimisticQty])

  return (
    <div className="group relative flex flex-col" data-testid="product-wrapper">
      {(cheapestPrice?.price_type === "sale" || (product as { tags?: unknown[] })?.tags?.length || firstVariant) ? (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {(cheapestPrice?.price_type === "sale" || (product as { tags?: unknown[] })?.tags?.length) ? (
            <SavingsBadge price={cheapestPrice} product={product as { tags?: Array<{ value?: string } | string> }} variant="compact" />
          ) : null}
          <StockStatusBadge variant={firstVariant as { manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number }} variantStyle="compact" />
        </div>
      ) : null}
      <div className="absolute top-2 right-2 z-10">
        <AddToWishlistButton
          productId={product.id!}
          variantId={firstVariantId}
          showAsIcon
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <LocalizedClientLink href={`/products/${product.handle}`} className="flex-1 flex flex-col">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          isFeatured={isFeatured}
          imageFit={imageFit ?? "cover"}
        />
        <div className="flex txt-compact-medium mt-3 tablet:mt-4 justify-between gap-2">
          <Text className="text-ui-fg-subtle text-xs tablet:text-sm line-clamp-2 flex-1" data-testid="product-title">
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2 shrink-0">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </LocalizedClientLink>
      {firstVariantId && (
        <div className="mt-2">
          {isInCart ? (
            // Quantity selector when item is in cart (matches image design)
            <div className="flex items-center justify-center gap-3 w-full">
              <button
                onClick={handleDecreaseQuantity}
                disabled={isUpdating || !lineItemId}
                className={clx(
                  "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all",
                  isUpdating
                    ? "border-ui-border-base text-ui-fg-disabled cursor-not-allowed bg-ui-bg-disabled"
                    : "border-ui-border-base text-ui-fg-base hover:border-ui-border-strong hover:bg-ui-bg-subtle-hover active:scale-95"
                )}
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center justify-center min-w-[70px] px-2">
                <Text className="text-lg font-semibold text-ui-fg-base leading-none">
                  {currentQuantity}
                </Text>
                <Text className="text-xs text-ui-fg-muted mt-0.5">In Cart</Text>
              </div>
              <button
                onClick={handleIncreaseQuantity}
                disabled={isUpdating || !hasInventory}
                className={clx(
                  "flex items-center justify-center w-9 h-9 rounded-full transition-all",
                  isUpdating || !hasInventory
                    ? "bg-ui-bg-disabled text-ui-fg-disabled cursor-not-allowed"
                    : "bg-ui-fg-interactive text-white hover:bg-ui-fg-interactive-hover active:scale-95 shadow-sm"
                )}
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // Add to Cart button when item is not in cart
            <Button
              onClick={handleAddToCart}
              disabled={isAdding || !hasInventory}
              className={clx("w-full", PRIMARY_ADD_TO_CART_BUTTON_CLASS)}
              size="small"
              variant="primary"
            >
              {isAdding ? (
                listLabels.adding
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {listLabels.addToCartTitleCase}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Memoize to prevent re-renders when parent re-renders (e.g. when cart context updates)
// Only re-render when product, cart prop, or internal state changes
const ProductPreview = React.memo(ProductPreviewComponent, (prevProps, nextProps) => {
  // Re-render if product changes
  if (prevProps.product.id !== nextProps.product.id) return false
  // Re-render if cart prop changes (reference comparison)
  if (prevProps.cart !== nextProps.cart) return false
  // Re-render if other props change
  if (prevProps.isFeatured !== nextProps.isFeatured) return false
  if (prevProps.region.id !== nextProps.region.id) return false
  if (prevProps.imageFit !== nextProps.imageFit) return false
  // Don't re-render if only context cart changed (we use cartProp on product list)
  return true
})

export default ProductPreview
