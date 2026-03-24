"use client"

import { addToCart } from "@lib/data/cart"
import { useShopInStoreListLabels } from "@lib/hooks/use-shop-in-store-list-mode"
import { PRIMARY_ADD_TO_CART_BUTTON_CLASS } from "@lib/ui/primary-add-to-cart-button"
import { dispatchCartUpdated } from "@modules/common/components/cart-provider"
import {
  removeFromWishlistByVariant,
  type WishlistItem,
} from "@lib/data/wishlist"
import { Button, Text, toast, clx } from "@medusajs/ui"
import { ShoppingCart, Trash } from "@medusajs/icons"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useRouter } from "next/navigation"
import { useState } from "react"

type WishlistPageTemplateProps = {
  items: WishlistItem[]
  countryCode: string
}

export default function WishlistPageTemplate({
  items,
  countryCode,
}: WishlistPageTemplateProps) {
  const listLabels = useShopInStoreListLabels()
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)

  const handleRemove = async (item: WishlistItem) => {
    setRemovingId(item.product_variant_id)
    try {
      const result = await removeFromWishlistByVariant(
        item.product_variant_id,
        item.product_id
      )
      if (result.success) {
        toast.success("Removed from wishlist")
        router.refresh()
      } else {
        toast.error(result.error || "Could not remove")
      }
    } catch {
      toast.error("Could not remove from wishlist")
    } finally {
      setRemovingId(null)
    }
  }

  const handleAddToCart = async (variantId: string | undefined) => {
    if (!variantId) {
      toast.error("Could not add to cart: missing variant")
      return
    }
    setAddingId(variantId)
    try {
      await addToCart({
        variantId,
        quantity: 1,
        countryCode,
      })
      dispatchCartUpdated()
      toast.success(
        listLabels.isShopInStoreList ? "Added to list" : "Added to cart"
      )
      router.refresh()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not add to cart"
      )
    } finally {
      setAddingId(null)
    }
  }

  if (!items.length) {
    return (
      <div className="content-container py-12 text-center">
        <Text className="text-ui-fg-subtle text-large-regular">
          Your wishlist is empty.
        </Text>
        <LocalizedClientLink href="/store">
          <Button variant="secondary" className="mt-4">
            Continue shopping
          </Button>
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="content-container py-8">
      <h1 className="text-2xl font-semibold mb-6">Wishlist</h1>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item, index) => {
          const isRemoving = removingId === item.product_variant_id
          const isAdding = addingId === item.product_variant_id
          const key =
            item.id ||
            (item.product_id && item.product_variant_id
              ? `${item.product_id}-${item.product_variant_id}`
              : `wishlist-item-${index}`)

          return (
            <li
              key={key}
              className="group flex flex-col bg-white border border-ui-border-base rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <LocalizedClientLink
                href={item.product?.handle ? `/products/${item.product.handle}` : "/store"}
                className="flex flex-1 min-w-0 flex-col"
              >
                <Thumbnail
                  thumbnail={item.product?.thumbnail}
                  size="full"
                  className="w-full shrink-0 !rounded-none !p-0 shadow-none ring-0"
                />
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-base font-semibold text-ui-fg-base line-clamp-2 group-hover:text-ui-fg-base">
                    {item.product?.title ?? "Product"}
                  </h3>
                </div>
              </LocalizedClientLink>
              <div className="px-4 pb-4 flex gap-2 items-center">
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    handleAddToCart(item.product_variant_id)
                  }}
                  disabled={isAdding || !item.product_variant_id}
                  variant="primary"
                  className={clx(
                    "w-full flex-1",
                    PRIMARY_ADD_TO_CART_BUTTON_CLASS
                  )}
                  isLoading={isAdding}
                  data-testid="wishlist-add-to-cart"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {isAdding ? listLabels.adding : listLabels.addToCart}
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={isRemoving}
                  isLoading={isRemoving}
                  onClick={(e) => {
                    e.preventDefault()
                    handleRemove(item)
                  }}
                  className="text-ui-fg-muted hover:text-ui-fg-base shrink-0"
                  data-testid="wishlist-remove"
                >
                  <Trash />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
