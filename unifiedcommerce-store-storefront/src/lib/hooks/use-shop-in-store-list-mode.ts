"use client"

import {
  ensureHeaderFulfillmentCookieSyncedWithStorage,
  HEADER_FULFILLMENT_CHANGED_EVENT,
  readHeaderFulfillmentPreference,
} from "@lib/config/checkout-method-options"
import { useEffect, useMemo, useState } from "react"

/**
 * “Shop in Store (list)” UX only while the header fulfillment preference is `in_store`.
 * Switching to Shop for Delivery restores normal Add to cart / Cart / checkout copy even if
 * list metadata remains on the cart.
 */
export function useShopInStoreListActive(): boolean {
  const [prefInStore, setPrefInStore] = useState(false)

  useEffect(() => {
    ensureHeaderFulfillmentCookieSyncedWithStorage()
    const read = () =>
      setPrefInStore(readHeaderFulfillmentPreference() === "in_store")
    read()
    window.addEventListener(HEADER_FULFILLMENT_CHANGED_EVENT, read)
    return () =>
      window.removeEventListener(HEADER_FULFILLMENT_CHANGED_EVENT, read)
  }, [])

  return useMemo(() => prefInStore, [prefInStore])
}

export function useShopInStoreListLabels() {
  const list = useShopInStoreListActive()
  return useMemo(
    () => ({
      isShopInStoreList: list,
      addToCart: list ? "Add to List" : "Add to cart",
      addToCartTitleCase: list ? "Add to List" : "Add to Cart",
      adding: list ? "Adding..." : "Adding...",
      inCartSecondary: list ? "On list" : "In Cart",
      goToCart: list ? "Go to shopping list" : "Go to cart",
      backToCartLong: list ? "Back to shopping list" : "Back to shopping cart",
      cartTitle: list ? "Shopping list" : "Cart",
      emptyCartTitle: list ? "Shopping list" : "Cart",
    }),
    [list]
  )
}
