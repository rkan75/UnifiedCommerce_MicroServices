import type { HeaderFulfillmentPreference } from "@lib/config/checkout-method-options"

type CartLike = { metadata?: Record<string, unknown> | null } | null | undefined

/** Cart has a store chosen for “Shop in Store (Create a list)”. */
export function cartHasInStoreListStore(cart: CartLike): boolean {
  const id = cart?.metadata?.in_store_list_store_id
  return id != null && String(id).trim() !== ""
}

export function cartIsPickupFulfillment(cart: CartLike): boolean {
  return cart?.metadata?.checkout_fulfillment === "pickup"
}

/**
 * Shopping-list cart/checkout copy (SSR): only when the header mode cookie is `in_store`.
 * Cart may still carry `in_store_list_*` metadata after switching to Shop for Delivery; we ignore it then.
 */
export function cartUsesShoppingListUi(
  cart: CartLike,
  headerFulfillment: HeaderFulfillmentPreference | null | undefined
): boolean {
  const mode = headerFulfillment ?? "delivery"
  return Boolean(cart && mode === "in_store" && !cartIsPickupFulfillment(cart))
}

/** Checkout should show the in-store shopping list review UI (not standard Medusa checkout). */
export function cartShowsShopInStoreReview(
  cart: CartLike,
  headerFulfillment: HeaderFulfillmentPreference | null | undefined
): boolean {
  if (!cartUsesShoppingListUi(cart, headerFulfillment)) return false
  return cartHasInStoreListStore(cart)
}
